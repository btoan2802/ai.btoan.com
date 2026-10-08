using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using BtoanAiNet.Hubs;

namespace BtoanAiNet.Services
{
    public class ProjectRuntimeManagerService : IProjectRuntimeManagerService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<TerminalHub> _hubContext;

        private static readonly ConcurrentDictionary<int, RunningProjectInstance> ProjectInstances = new();
        private static readonly ConcurrentDictionary<int, int> ProjectPortMap = new();
        private static int NextPort = 6001;
        private static readonly object PortLock = new();

        private static readonly string[] CommandWhitelist = new[]
        {
            "dotnet", "npm", "node", "python", "pip", "git", "npx"
        };

        public ProjectRuntimeManagerService(
            IServiceScopeFactory scopeFactory,
            IHubContext<TerminalHub> hubContext)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
        }

        public async Task<RuntimeStatusResult> StartProjectRuntimeAsync(int projectId, int userId, string webRoot)
        {
            using var scope = _scopeFactory.CreateScope();
            var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

            if (!await workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            string workspaceDir = await workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
            if (!Directory.Exists(workspaceDir))
            {
                Directory.CreateDirectory(workspaceDir);
            }

            int port = GetOrCreatePortForProject(projectId);
            string projectType = DetectProjectType(workspaceDir);

            if (ProjectInstances.TryGetValue(projectId, out var existingInstance))
            {
                if (existingInstance.Process != null && !existingInstance.Process.HasExited)
                {
                    try { existingInstance.Process.Kill(true); } catch { }
                }
            }

            var instance = new RunningProjectInstance
            {
                ProjectId = projectId,
                UserId = userId,
                Port = port,
                ProjectType = projectType,
                Status = "Building",
                StartTime = DateTime.UtcNow,
                WorkspaceDir = workspaceDir,
                PreviewUrl = $"http://localhost:{port}"
            };

            ProjectInstances[projectId] = instance;

            _ = Task.Run(() => RunProjectProcessPipeline(instance));

            return MapToStatusResult(instance);
        }

        public async Task<bool> StopProjectRuntimeAsync(int projectId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

            if (!await workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (ProjectInstances.TryGetValue(projectId, out var instance))
            {
                if (instance.Process != null && !instance.Process.HasExited)
                {
                    try { instance.Process.Kill(true); } catch { }
                }
                instance.Status = "Stopped";
                return true;
            }
            return false;
        }

        public async Task<RuntimeStatusResult> RestartProjectRuntimeAsync(int projectId, int userId, string webRoot)
        {
            await StopProjectRuntimeAsync(projectId, userId);
            await Task.Delay(500);
            return await StartProjectRuntimeAsync(projectId, userId, webRoot);
        }

        public async Task<RuntimeStatusResult> GetProjectRuntimeStatusAsync(int projectId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

            if (!await workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (ProjectInstances.TryGetValue(projectId, out var instance))
            {
                if (instance.Process != null && !instance.Process.HasExited)
                {
                    try
                    {
                        instance.Process.Refresh();
                        instance.MemoryMb = Math.Round(instance.Process.WorkingSet64 / (1024.0 * 1024.0), 2);
                    }
                    catch { }
                }
                return MapToStatusResult(instance);
            }

            int defaultPort = GetOrCreatePortForProject(projectId);
            return new RuntimeStatusResult
            {
                ProjectId = projectId,
                Port = defaultPort,
                Status = "Stopped",
                ProjectType = "Unknown",
                PreviewUrl = $"http://localhost:{defaultPort}"
            };
        }

        public async Task<RuntimeLogsResult> GetProjectRuntimeLogsAsync(int projectId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

            if (!await workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (ProjectInstances.TryGetValue(projectId, out var instance))
            {
                string stdout = instance.StdOutBuilder.ToString();
                string stderr = instance.StdErrBuilder.ToString();

                var warnings = stdout.Split('\n').Where(l => l.Contains("warning", StringComparison.OrdinalIgnoreCase)).ToList();
                var errors = stderr.Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();

                return new RuntimeLogsResult
                {
                    ProjectId = projectId,
                    StdOut = stdout,
                    StdErr = stderr,
                    Warnings = warnings,
                    Errors = errors
                };
            }

            return new RuntimeLogsResult { ProjectId = projectId };
        }

        public async Task<string> GetLivePreviewUrlAsync(int projectId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

            if (!await workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            int port = GetOrCreatePortForProject(projectId);
            return $"http://localhost:{port}";
        }

        private async Task RunProjectProcessPipeline(RunningProjectInstance instance)
        {
            try
            {
                string cmdName = string.Empty;
                string cmdArgs = string.Empty;

                bool isWindows = OperatingSystem.IsWindows();

                switch (instance.ProjectType)
                {
                    case "ASPNET":
                        cmdName = "dotnet";
                        cmdArgs = $"run --urls=http://localhost:{instance.Port}";
                        break;
                    case "NodeJS":
                        cmdName = isWindows ? "cmd.exe" : "npm";
                        cmdArgs = isWindows ? $"/c \"npm run dev -- --port {instance.Port}\"" : $"run dev -- --port {instance.Port}";
                        break;
                    case "Python":
                        cmdName = "python";
                        cmdArgs = $"app.py --port {instance.Port}";
                        break;
                    default:
                        cmdName = "dotnet";
                        cmdArgs = $"run --urls=http://localhost:{instance.Port}";
                        break;
                }

                var psi = new ProcessStartInfo
                {
                    FileName = cmdName,
                    Arguments = cmdArgs,
                    WorkingDirectory = instance.WorkspaceDir,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                var process = new Process { StartInfo = psi };
                instance.Process = process;

                process.OutputDataReceived += async (s, e) =>
                {
                    if (e.Data != null)
                    {
                        string line = e.Data + "\n";
                        instance.StdOutBuilder.Append(line);
                    }
                };

                process.ErrorDataReceived += async (s, e) =>
                {
                    if (e.Data != null)
                    {
                        string line = e.Data + "\n";
                        instance.StdErrBuilder.Append(line);
                    }
                };

                process.Start();
                instance.Status = "Running";
                instance.Pid = process.Id;

                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                await process.WaitForExitAsync();

                if (instance.Status != "Stopped" && process.ExitCode != 0)
                {
                    instance.Status = "Crashed";
                    instance.CrashCount++;

                    // Auto-Restart Loop (Up to 3 times)
                    if (instance.CrashCount <= 3)
                    {
                        await Task.Delay(1000);
                        instance.Status = "Building";
                        _ = Task.Run(() => RunProjectProcessPipeline(instance));
                    }
                }
            }
            catch (Exception ex)
            {
                instance.Status = "BuildFailed";
                instance.StdErrBuilder.Append($"Runtime Failure: {ex.Message}\n");
            }
        }

        private static string DetectProjectType(string workspaceDir)
        {
            if (Directory.Exists(workspaceDir))
            {
                if (Directory.GetFiles(workspaceDir, "*.csproj", SearchOption.AllDirectories).Length > 0)
                    return "ASPNET";
                if (File.Exists(Path.Combine(workspaceDir, "package.json")))
                    return "NodeJS";
                if (File.Exists(Path.Combine(workspaceDir, "app.py")) || File.Exists(Path.Combine(workspaceDir, "main.py")))
                    return "Python";
                if (File.Exists(Path.Combine(workspaceDir, "index.html")))
                    return "StaticHTML";
            }
            return "ASPNET";
        }

        private static int GetOrCreatePortForProject(int projectId)
        {
            lock (PortLock)
            {
                if (ProjectPortMap.TryGetValue(projectId, out int port))
                {
                    return port;
                }
                int assignedPort = NextPort++;
                ProjectPortMap[projectId] = assignedPort;
                return assignedPort;
            }
        }

        private static RuntimeStatusResult MapToStatusResult(RunningProjectInstance instance)
        {
            return new RuntimeStatusResult
            {
                ProjectId = instance.ProjectId,
                Pid = instance.Process != null && !instance.Process.HasExited ? instance.Process.Id : null,
                Port = instance.Port,
                Status = instance.Status,
                ProjectType = instance.ProjectType,
                StartTime = instance.StartTime,
                MemoryMb = instance.MemoryMb,
                CpuPercent = instance.CpuPercent,
                CrashCount = instance.CrashCount,
                PreviewUrl = instance.PreviewUrl
            };
        }

        private class RunningProjectInstance
        {
            public int ProjectId { get; set; }
            public int UserId { get; set; }
            public int Port { get; set; }
            public int? Pid { get; set; }
            public string ProjectType { get; set; } = "Unknown";
            public string Status { get; set; } = "Stopped";
            public DateTime StartTime { get; set; }
            public string WorkspaceDir { get; set; } = string.Empty;
            public string PreviewUrl { get; set; } = string.Empty;

            public Process? Process { get; set; }
            public StringBuilder StdOutBuilder { get; } = new();
            public StringBuilder StdErrBuilder { get; } = new();

            public double MemoryMb { get; set; }
            public double CpuPercent { get; set; }
            public int CrashCount { get; set; }
        }
    }
}
