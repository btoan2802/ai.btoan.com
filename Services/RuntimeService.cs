using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BtoanAiNet.Data;
using BtoanAiNet.Hubs;
using BtoanAiNet.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class RuntimeService : IRuntimeService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IWorkspaceService _workspaceService;
        private readonly IHubContext<TerminalHub> _hubContext;
        private static readonly ConcurrentDictionary<int, Process> RunningProcesses = new();

        // Dangerous Blacklisted Commands/Keywords Filtering
        private static readonly string[] DangerousPatterns = new[]
        {
            @"\brm\s+-rf\b",
            @"\bformat\s+[a-z]:\b",
            @"\bshutdown\b",
            @"\bdiskpart\b",
            @"\bmkfs\b",
            @"\bsc\s+stop\b",
            @"\bdel\s+/[f|s|q]\b",
            @"\bdrop\s+database\b",
            @"\breboot\b",
            @"\binit\s+0\b"
        };

        public RuntimeService(
            IServiceScopeFactory scopeFactory,
            IWorkspaceService workspaceService,
            IHubContext<TerminalHub> hubContext)
        {
            _scopeFactory = scopeFactory;
            _workspaceService = workspaceService;
            _hubContext = hubContext;
        }

        public async Task<TerminalSession> CreateEnvironmentAndExecuteAsync(int projectId, string command, int userId, string webRoot)
        {
            if (string.IsNullOrWhiteSpace(command))
                throw new ArgumentException("Command cannot be empty");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            foreach (var pattern in DangerousPatterns)
            {
                if (Regex.IsMatch(command, pattern, RegexOptions.IgnoreCase))
                {
                    throw new InvalidOperationException($"Security Rejection: Command '{command}' is blacklisted due to dangerous system instructions.");
                }
            }

            string targetWorkingDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
            if (!Directory.Exists(targetWorkingDir))
            {
                Directory.CreateDirectory(targetWorkingDir);
            }

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var session = new TerminalSession
            {
                ProjectId = projectId,
                UserId = userId,
                Command = command.Trim(),
                Status = "Running",
                StdOut = string.Empty,
                StdErr = string.Empty,
                StartedAt = DateTime.UtcNow
            };

            dbContext.TerminalSessions.Add(session);
            await dbContext.SaveChangesAsync();

            _ = Task.Run(() => ExecuteProcessPipeline(session.Id, targetWorkingDir, command.Trim()));

            return session;
        }

        public async Task<TerminalSession?> GetSessionOutputAsync(int sessionId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var session = await dbContext.TerminalSessions.FindAsync(sessionId);
            if (session == null) return null;

            if (!await _workspaceService.ValidateProjectOwnershipAsync(session.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            return session;
        }

        public async Task<bool> StopExecutionAsync(int sessionId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var session = await dbContext.TerminalSessions.FindAsync(sessionId);
            if (session == null) return false;

            if (!await _workspaceService.ValidateProjectOwnershipAsync(session.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (RunningProcesses.TryRemove(sessionId, out var proc))
            {
                try
                {
                    if (!proc.HasExited)
                    {
                        proc.Kill(true);
                    }
                }
                catch { }

                session.Status = "Stopped";
                session.FinishedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();

                await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("StatusChanged", sessionId, "Stopped", -1);
                return true;
            }

            return false;
        }

        private async Task ExecuteProcessPipeline(int sessionId, string workingDir, string command)
        {
            var stdOutBuilder = new StringBuilder();
            var stdErrBuilder = new StringBuilder();

            try
            {
                bool isWindows = OperatingSystem.IsWindows();
                string fileName = isWindows ? "cmd.exe" : "/bin/bash";
                string args = isWindows ? $"/c \"{command}\"" : $"-c \"{command}\"";

                var psi = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = args,
                    WorkingDirectory = workingDir,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = new Process { StartInfo = psi };
                RunningProcesses[sessionId] = process;

                process.OutputDataReceived += async (s, e) =>
                {
                    if (e.Data != null)
                    {
                        string line = e.Data + "\n";
                        stdOutBuilder.Append(line);
                        await UpdateSessionBufferAsync(sessionId, stdOutBuilder.ToString(), stdErrBuilder.ToString(), "Running", null);
                        await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("ReceiveOutput", sessionId, line, false);
                    }
                };

                process.ErrorDataReceived += async (s, e) =>
                {
                    if (e.Data != null)
                    {
                        string line = e.Data + "\n";
                        stdErrBuilder.Append(line);
                        await UpdateSessionBufferAsync(sessionId, stdOutBuilder.ToString(), stdErrBuilder.ToString(), "Running", null);
                        await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("ReceiveOutput", sessionId, line, true);
                    }
                };

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                bool exited = await Task.Run(() => process.WaitForExit(300000));

                RunningProcesses.TryRemove(sessionId, out _);

                if (!exited)
                {
                    try { process.Kill(true); } catch { }
                    string timeoutMsg = "\n[Process timed out after 5 minutes]\n";
                    stdErrBuilder.Append(timeoutMsg);
                    await UpdateSessionBufferAsync(sessionId, stdOutBuilder.ToString(), stdErrBuilder.ToString(), "TimedOut", -1);
                    await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("ReceiveOutput", sessionId, timeoutMsg, true);
                    await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("StatusChanged", sessionId, "TimedOut", -1);
                }
                else
                {
                    string status = process.ExitCode == 0 ? "Completed" : "Failed";
                    await UpdateSessionBufferAsync(sessionId, stdOutBuilder.ToString(), stdErrBuilder.ToString(), status, process.ExitCode);
                    await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("StatusChanged", sessionId, status, process.ExitCode);
                }
            }
            catch (Exception ex)
            {
                RunningProcesses.TryRemove(sessionId, out _);
                string errMsg = $"Runtime Execution Error: {ex.Message}\n";
                stdErrBuilder.Append(errMsg);
                await UpdateSessionBufferAsync(sessionId, stdOutBuilder.ToString(), stdErrBuilder.ToString(), "Failed", -1);
                await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("ReceiveOutput", sessionId, errMsg, true);
                await _hubContext.Clients.Group($"session_{sessionId}").SendAsync("StatusChanged", sessionId, "Failed", -1);
            }
        }

        private async Task UpdateSessionBufferAsync(int sessionId, string stdout, string stderr, string status, int? exitCode)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var dbSession = await dbContext.TerminalSessions.FindAsync(sessionId);
                if (dbSession != null)
                {
                    dbSession.StdOut = stdout;
                    dbSession.StdErr = stderr;
                    dbSession.Status = status;
                    if (exitCode.HasValue) dbSession.ExitCode = exitCode.Value;
                    if (status != "Running") dbSession.FinishedAt = DateTime.UtcNow;

                    await dbContext.SaveChangesAsync();
                }
            }
            catch { }
        }
    }
}
