using System.Diagnostics;

namespace BtoanAiNet.Services
{
    public class TerminalExecutionResult
    {
        public int ExitCode { get; set; }
        public string StdOut { get; set; } = string.Empty;
        public string StdErr { get; set; } = string.Empty;
        public string Command { get; set; } = string.Empty;
        public string WorkingDirectory { get; set; } = string.Empty;
        public bool Success => ExitCode == 0;
    }

    public interface ITerminalExecutionService
    {
        Task<TerminalExecutionResult> ExecuteCommandAsync(string workingDir, string command);
    }

    public class TerminalExecutionService : ITerminalExecutionService
    {
        private static readonly string[] DangerousKeywords = new[]
        {
            "format ", "rmdir /s", "del /f", "rm -rf /", "shutdown", "reg ", "bcdedit",
            "net user", "vssadmin", "powershell start-process", "runas", "attrib ",
            "BtoanAiNet", "..\\..", "../.."
        };

        public async Task<TerminalExecutionResult> ExecuteCommandAsync(string workingDir, string command)
        {
            var result = new TerminalExecutionResult
            {
                Command = command,
                WorkingDirectory = workingDir
            };

            if (string.IsNullOrWhiteSpace(command))
            {
                result.ExitCode = -1;
                result.StdErr = "Security Exception: Empty command string.";
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

            // 2. Ensure Working Directory is inside uploads/workspaces
            string normalizedWorkingDir = Path.GetFullPath(workingDir);
            if (!normalizedWorkingDir.Contains(Path.Combine("uploads", "workspaces"), StringComparison.OrdinalIgnoreCase))
            {
                result.ExitCode = -1;
                result.StdErr = "Security Violation: Execution path outside isolated workspace directory is forbidden.";
                return result;
            }

            if (!Directory.Exists(normalizedWorkingDir))
            {
                Directory.CreateDirectory(normalizedWorkingDir);
            }

            return await Task.Run(() =>
            {
                try
                {
                    string shell = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash";
                    string args = OperatingSystem.IsWindows() ? $"/c {command}" : $"-c \"{command.Replace("\"", "\\\"")}\"";

                    var psi = new ProcessStartInfo
                    {
                        FileName = shell,
                        Arguments = args,
                        WorkingDirectory = normalizedWorkingDir,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using var proc = Process.Start(psi);
                    if (proc == null)
                    {
                        result.ExitCode = -1;
                        result.StdErr = "Failed to spawn process shell.";
                        return result;
                    }

                    // 3. Process Timeout Enforcement (30s)
                    if (!proc.WaitForExit(30000))
                    {
                        try { proc.Kill(true); } catch { }
                        result.ExitCode = -1;
                        result.StdErr = "Execution Timeout Exception: Command exceeded 30 seconds time limit.";
                        return result;
                    }

                    result.ExitCode = proc.ExitCode;
                    result.StdOut = proc.StandardOutput.ReadToEnd();
                    result.StdErr = proc.StandardError.ReadToEnd();
                }
                catch (Exception ex)
                {
                    result.ExitCode = -1;
                    result.StdErr = $"Execution Exception: {ex.Message}";
                }

                return result;
            });
        }
    }
}
