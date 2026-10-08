using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IAgentWorkflowService
    {
        Task<AgentTask> CreateTaskAndAnalyzeAsync(int projectId, string prompt, int userId, string webRoot);
        Task<AgentTask?> GetTaskDetailsAsync(int taskId, int userId);
        Task<List<AgentChange>> GetTaskChangesAsync(int taskId, int userId);
        Task<bool> ProcessBuildLoopAsync(int taskId, int userId, string webRoot);
    }
}
