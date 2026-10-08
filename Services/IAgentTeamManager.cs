using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IAgentTeamManager
    {
        Task<TeamRunResult> RunTeamWorkflowAsync(int projectId, string prompt, int userId, string webRoot);
        Task<List<TeamAgentStatusDto>> GetTeamStatusAsync(int projectId, int userId);
        Task<List<AgentTeamMessage>> GetTeamMessagesAsync(int projectId, int userId);
        Task<List<ProjectKnowledgeBase>> GetTeamKnowledgeBaseAsync(int projectId, int userId);
    }

    public class TeamRunResult
    {
        public int ProjectId { get; set; }
        public string Prompt { get; set; } = string.Empty;
        public string AdrSummary { get; set; } = string.Empty;
        public List<TeamAgentTaskDto> Tasks { get; set; } = new();
        public List<AgentTeamMessageDto> Messages { get; set; } = new();
        public CodeReviewScoreDto ReviewScore { get; set; } = new();
        public bool BuildSucceeded { get; set; }
        public int ProposedChangesCount { get; set; }
    }

    public class TeamAgentTaskDto
    {
        public int Id { get; set; }
        public string AssignedAgent { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string Status { get; set; } = "Pending";
        public int Order { get; set; }
    }

    public class AgentTeamMessageDto
    {
        public string FromAgent { get; set; } = string.Empty;
        public string ToAgent { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class TeamAgentStatusDto
    {
        public string AgentName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Status { get; set; } = "Idle"; // Idle, Working, Completed, Failed
        public string CurrentTask { get; set; } = string.Empty;
    }

    public class CodeReviewScoreDto
    {
        public int ArchitectureScore { get; set; } = 8;
        public int SecurityScore { get; set; } = 9;
        public int PerformanceScore { get; set; } = 8;
        public int MaintainabilityScore { get; set; } = 9;
    }
}
