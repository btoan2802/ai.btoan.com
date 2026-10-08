using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IAgentOrchestrator
    {
        Task<AutonomousRunResult> RunAutonomousWorkflowAsync(int projectId, string prompt, int userId, string mode, string webRoot);
        Task<bool> ApproveAutonomousTaskAsync(int agentTaskId, int userId, string webRoot);
        Task<List<AutonomousAgentTask>> GetProjectAutonomousTasksAsync(int projectId, int userId);
        Task<List<string>> GetExecutionLogsAsync(int projectId, int userId);
    }

    public class AutonomousRunResult
    {
        public int AgentTaskId { get; set; }
        public int ProjectId { get; set; }
        public string Mode { get; set; } = "AUTO"; // AUTO or SAFE
        public string Status { get; set; } = "Completed";
        public List<AutonomousSubtaskDto> Subtasks { get; set; } = new();
        public List<AgentChangeDto> Changes { get; set; } = new();
        public List<string> ExecutionLogs { get; set; } = new();
        public bool BuildSucceeded { get; set; }
        public int SelfHealRetries { get; set; }
    }

    public class AutonomousSubtaskDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";
        public int Order { get; set; }
    }

    public class AgentChangeDto
    {
        public string FilePath { get; set; } = string.Empty;
        public string ChangeType { get; set; } = "Create";
        public string OldContent { get; set; } = string.Empty;
        public string NewContent { get; set; } = string.Empty;
    }
}
