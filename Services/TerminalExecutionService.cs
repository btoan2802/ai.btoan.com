using System.Diagnostics;
using System.Text;

namespace BtoanAiNet.Services
{
    public class TerminalExecutionResult
    {
        public int ExitCode { get; set; }
        public string StdOut { get; set; } = string.Empty;
        public string StdErr { get; set; } = string.Empty;
        public string Command { get; set; } = string.Empty;
        public string WorkingDirectory { get; set; } = string.Empty;
        public bool IsSandboxed { get; set; }
        public TimeSpan Duration { get; set; }
        public bool Success => ExitCode == 0;
    }

    public class DockerSandboxOptions
    {
        public string DefaultImage { get; set; } = "mcr.microsoft.com/dotnet/sdk:10.0-alpine";
        public string MemoryLimit { get; set; } = "512m";
        public double CpuLimit { get; set; } = 1.0;
        public int PidsLimit { get; set; } = 64;
        public int ExecutionTimeoutSeconds { get; set; } = 45;
        public bool AllowNetworkAccess { get; set; } = false;
        public bool FallbackToRestrictedHost { get; set; } = true;
    }

    public interface ITerminalExecutionService
    {
        Task<TerminalExecutionResult> ExecuteCommandAsync(
            string workingDir, 
            string command, 
            string? customImage = null, 
            CancellationToken cancellationToken = default);
        
        Task<bool> IsDockerAvailableAsync();
    }

    public class TerminalExecutionService : ITerminalExecutionService
    {
        private readonly ILogger<TerminalExecutionService> _logger;
        private readonly DockerSandboxOptions _options;
        private static bool? _isDockerCached;
        private static readonly SemaphoreSlim DockerCheckLock = new(1, 1);

        private static readonly string[] DangerousKeywords = new[]
        {
            "format ", "rmdir /s", "del /f", "rm -rf /", "shutdown", "reg ", "bcdedit",
            "net user", "vssadmin", "powershell start-process", "runas", "attrib ",
            "BtoanAiNet", "..\\..", "../..", ":(){ :|:& };:"
        };

        public TerminalExecutionService(
            ILogger<TerminalExecutionService> logger,
            IConfiguration configuration)
        {
            _logger = logger;
            _options = configuration.GetSection("DockerSandbox").Get<DockerSandboxOptions>() 
                       ?? new DockerSandboxOptions();
        }

        public async Task<bool> IsDockerAvailableAsync()
        {
            if (_isDockerCached.HasValue) return _isDockerCached.Value;

            await DockerCheckLock.WaitAsync();
            try
            {
                if (_isDockerCached.HasValue) return _isDockerCached.Value;

                var psi = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = "version --format \"{{.Server.Version}}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var proc = Process.Start(psi);
                if (proc == null)
                {
                    _isDockerCached = false;
                    return false;
                }

                await proc.WaitForExitAsync();
                _isDockerCached = proc.ExitCode == 0;
                return _isDockerCached.Value;
            }
            catch
            {
                _isDockerCached = false;
                return false;
            }
            finally
            {
                DockerCheckLock.Release();
            }
        }

        public async Task<TerminalExecutionResult> ExecuteCommandAsync(
            string workingDir, 
            string command, 
            string? customImage = null, 
            CancellationToken cancellationToken = default)
        {
            var sw = Stopwatch.StartNew();
            var result = new TerminalExecutionResult
            {
                Command = command,
                WorkingDirectory = workingDir
            };

            if (string.IsNullOrWhiteSpace(command))
            {
                result.ExitCode = -1;
                result.StdErr = "Validation Error: Command string cannot be empty.";
                return result;
            }

            // 1. Sanitize & Check Dangerous Keywords
            string lowerCmd = command.ToLowerInvariant().Trim();
            foreach (var blocked in DangerousKeywords)
            {
                if (lowerCmd.Contains(blocked.ToLowerInvariant()))
                {
                    result.ExitCode = -1;
                    result.StdErr = $"Security Violation: Command contains forbidden keyword '{blocked}'.";
                    return result;
                }
            }

            // 2. Validate workspace directory path
            string fullWorkingDir = Path.GetFullPath(workingDir);
            if (!Directory.Exists(fullWorkingDir))
            {
                Directory.CreateDirectory(fullWorkingDir);
            }

            bool dockerReady = await IsDockerAvailableAsync();
            if (!dockerReady)
            {
                if (!_options.FallbackToRestrictedHost)
                {
                    result.ExitCode = -1;
                    result.StdErr = "Infrastructure Error: Docker Daemon is offline and restricted host fallback is disabled.";
                    return result;
                }
                return await ExecuteOnRestrictedHostAsync(fullWorkingDir, command, sw, cancellationToken);
            }

            // 3. Execute inside Docker Sandbox Container
            return await ExecuteInDockerSandboxAsync(fullWorkingDir, command, customImage ?? _options.DefaultImage, sw, cancellationToken);
        }

        private async Task<TerminalExecutionResult> ExecuteInDockerSandboxAsync(
            string hostWorkingDir, 
            string command, 
            string dockerImage, 
            Stopwatch sw, 
            CancellationToken cancellationToken)
        {
            var result = new TerminalExecutionResult
            {
                Command = command,
                WorkingDirectory = hostWorkingDir,
                IsSandboxed = true
            };

            string networkFlag = _options.AllowNetworkAccess ? "--network bridge" : "--network none";
            string containerName = $"btoan_sandbox_{Guid.NewGuid():N}";
            string escapedCmd = command.Replace("\"", "\\\"");

            var dockerArgs = new StringBuilder();
            dockerArgs.Append($"run --rm --name {containerName} ");
            dockerArgs.Append($"-m {_options.MemoryLimit} --memory-swap {_options.MemoryLimit} ");
            dockerArgs.Append($"--cpus {_options.CpuLimit} ");
            dockerArgs.Append($"--pids-limit {_options.PidsLimit} ");
            dockerArgs.Append($"{networkFlag} ");
            dockerArgs.Append("--cap-drop ALL ");
            dockerArgs.Append("--security-opt no-new-privileges ");
            dockerArgs.Append($"-v \"{hostWorkingDir}:/workspace:rw\" ");
            dockerArgs.Append("-w /workspace ");
            dockerArgs.Append($"{dockerImage} ");
            dockerArgs.Append($"/bin/sh -c \"{escapedCmd}\"");

            var psi = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = dockerArgs.ToString(),
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = psi };
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(_options.ExecutionTimeoutSeconds));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

            try
            {
                process.Start();

                var stdoutTask = process.StandardOutput.ReadToEndAsync(linkedCts.Token);
                var stderrTask = process.StandardError.ReadToEndAsync(linkedCts.Token);

                await process.WaitForExitAsync(linkedCts.Token);

                result.ExitCode = process.ExitCode;
                result.StdOut = await stdoutTask;
                result.StdErr = await stderrTask;
            }
            catch (OperationCanceledException)
            {
                await ForceKillContainerAsync(containerName);
                result.ExitCode = -1;
                result.StdErr = timeoutCts.IsCancellationRequested
                    ? $"Execution Timeout: Sandbox task exceeded limit of {_options.ExecutionTimeoutSeconds}s."
                    : "Execution Aborted: Task was cancelled by caller.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to run command inside docker sandbox: {Command}", command);
                result.ExitCode = -1;
                result.StdErr = $"Sandbox Internal Exception: {ex.Message}";
            }
            finally
            {
                sw.Stop();
                result.Duration = sw.Elapsed;
            }

            return result;
        }

        private async Task ForceKillContainerAsync(string containerName)
        {
            try
            {
                var killPsi = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"rm -f {containerName}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var p = Process.Start(killPsi);
                if (p != null) await p.WaitForExitAsync();
            }
            catch { }
        }

        private async Task<TerminalExecutionResult> ExecuteOnRestrictedHostAsync(
            string workingDir, 
            string command, 
            Stopwatch sw,
            CancellationToken cancellationToken)
        {
            var result = new TerminalExecutionResult
            {
                Command = command,
                WorkingDirectory = workingDir,
                IsSandboxed = false
            };

            string shell = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/sh";
            string args = OperatingSystem.IsWindows() ? $"/c \"{command}\"" : $"-c \"{command.Replace("\"", "\\\"")}\"";

            var psi = new ProcessStartInfo
            {
                FileName = shell,
                Arguments = args,
                WorkingDirectory = workingDir,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var proc = new Process { StartInfo = psi };
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(_options.ExecutionTimeoutSeconds));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

            try
            {
                proc.Start();

                var stdoutTask = proc.StandardOutput.ReadToEndAsync(linkedCts.Token);
                var stderrTask = proc.StandardError.ReadToEndAsync(linkedCts.Token);

                await proc.WaitForExitAsync(linkedCts.Token);

                result.ExitCode = proc.ExitCode;
                result.StdOut = await stdoutTask;
                result.StdErr = await stderrTask;
            }
            catch (OperationCanceledException)
            {
                try { proc.Kill(true); } catch { }
                result.ExitCode = -1;
                result.StdErr = timeoutCts.IsCancellationRequested
                    ? $"Execution Timeout Exception: Command exceeded {_options.ExecutionTimeoutSeconds}s limit."
                    : "Execution Aborted: Command cancelled by caller.";
            }
            catch (Exception ex)
            {
                result.ExitCode = -1;
                result.StdErr = $"Execution Exception: {ex.Message}";
            }
            finally
            {
                sw.Stop();
                result.Duration = sw.Elapsed;
            }

            return result;
        }
    }
}
