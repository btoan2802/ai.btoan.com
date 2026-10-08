using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IRuntimeService
    {
        Task<TerminalSession> CreateEnvironmentAndExecuteAsync(int projectId, string command, int userId, string webRoot);
        Task<TerminalSession?> GetSessionOutputAsync(int sessionId, int userId);
        Task<bool> StopExecutionAsync(int sessionId, int userId);
    }
}
