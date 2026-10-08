using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IContextRetrieverService
    {
        Task<List<ProjectFile>> GetRelevantFilesAsync(int projectId, string prompt, int maxFiles = 5);
        Task<string> GetProjectMemorySummaryAsync(int projectId);
        Task SaveProjectMemoryAsync(int projectId, string key, string value);
    }
}
