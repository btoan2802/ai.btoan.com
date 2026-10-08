using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IDeploymentService
    {
        Task<DeploymentResultDto> DeployProjectAsync(int projectId, string environment, int userId, string webRoot);
        Task<bool> StopDeploymentAsync(int deploymentId, int userId);
        Task<bool> RestartDeploymentAsync(int deploymentId, int userId);
        Task<bool> RollbackDeploymentAsync(int deploymentId, int userId, string webRoot);
        Task<List<Deployment>> GetProjectDeploymentsAsync(int projectId, int userId);
        Task<List<DeploymentLog>> GetDeploymentLogsAsync(int deploymentId, int userId);
        Task<bool> SaveEnvironmentVariableAsync(int projectId, string environment, string key, string value, int userId);
        Task<List<ProjectEnvironmentVariableDto>> GetEnvironmentVariablesAsync(int projectId, int userId);
        Task<string> DetectFrameworkAsync(int projectId);
    }

    public class DeploymentResultDto
    {
        public int DeploymentId { get; set; }
        public int ProjectId { get; set; }
        public string Environment { get; set; } = "Production";
        public string Status { get; set; } = "Building";
        public string Url { get; set; } = string.Empty;
        public int Port { get; set; }
        public string Framework { get; set; } = "ASP.NET Core";
        public List<DeploymentLogDto> Logs { get; set; } = new();
        public bool IsRollbackTriggered { get; set; }
    }

    public class DeploymentLogDto
    {
        public string Step { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string LogLevel { get; set; } = "INFO";
        public DateTime Timestamp { get; set; }
    }

    public class ProjectEnvironmentVariableDto
    {
        public int Id { get; set; }
        public string Environment { get; set; } = "Production";
        public string Key { get; set; } = string.Empty;
        public string MaskedValue { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
