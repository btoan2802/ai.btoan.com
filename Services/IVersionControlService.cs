using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IVersionControlService
    {
        Task<ProjectVersion?> CreateSnapshotAsync(int projectId, int userId, string commitMessage, bool isAgent = false);
        Task<List<ProjectVersion>> GetProjectVersionsAsync(int projectId, int userId);
        Task<List<VersionDiffItem>> GetVersionDiffsAsync(int versionId, int userId);
        Task<ProjectVersion> RestoreVersionAsync(int versionId, int userId, string webRoot);
    }

    public class VersionDiffItem
    {
        public string FilePath { get; set; } = string.Empty;
        public string Action { get; set; } = "UPDATE"; // CREATE, UPDATE, DELETE
        public string OldContent { get; set; } = string.Empty;
        public string NewContent { get; set; } = string.Empty;
    }
}
