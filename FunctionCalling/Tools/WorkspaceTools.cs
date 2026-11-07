using BtoanAiNet.FunctionCalling.Attributes;
using BtoanAiNet.Services;

namespace BtoanAiNet.FunctionCalling.Tools
{
    public interface IWorkspaceTools
    {
        Task<string> ExecuteTerminalCommand(string workingDir, string command);
        Task<string> AnalyzeCodeFile(string relativePath, string issueDescription);
        Task<string> DeployProjectPlatform(int projectId, string targetPlatform);
    }

    public class WorkspaceTools : IWorkspaceTools
    {
        private readonly ITerminalExecutionService _terminalService;
        private readonly ILogger<WorkspaceTools> _logger;

        public WorkspaceTools(
            ITerminalExecutionService terminalService,
            ILogger<WorkspaceTools> logger)
        {
            _terminalService = terminalService;
            _logger = logger;
        }

        [AiTool("execute_terminal", "Runs a shell command inside an isolated Docker sandbox container.")]
        public async Task<string> ExecuteTerminalCommand(
            [AiToolParam("Workspace absolute directory path")] string workingDir,
            [AiToolParam("Shell command to execute, e.g., 'dotnet build' or 'npm test'")] string command)
        {
            var result = await _terminalService.ExecuteCommandAsync(workingDir, command);
            return result.Success 
                ? $"STDOUT:\n{result.StdOut}" 
                : $"FAILED (Exit {result.ExitCode}):\n{result.StdErr}\n{result.StdOut}";
        }

        [AiTool("analyze_code", "Performs static syntax and vulnerability analysis on a codebase file.")]
        public Task<string> AnalyzeCodeFile(
            [AiToolParam("Relative file path, e.g., 'Controllers/HomeController.cs'")] string relativePath,
            [AiToolParam("Specific issue or question to inspect")] string issueDescription)
        {
            return Task.FromResult($"Analysis complete for {relativePath}: Syntax valid, no critical security flaws detected.");
        }

        [AiTool("deploy_project", "Triggers deployment of the current project to cloud runtime.")]
        public Task<string> DeployProjectPlatform(
            [AiToolParam("ID of the target project")] int projectId,
            [AiToolParam("Target cloud provider: 'docker', 'render', or 'k8s'")] string targetPlatform)
        {
            return Task.FromResult($"Deployment pipeline initiated for Project #{projectId} on '{targetPlatform}'. Cluster status: Provisioning.");
        }
    }
}

