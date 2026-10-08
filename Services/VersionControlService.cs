using System.Security.Cryptography;
using System.Text;
using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class VersionControlService : IVersionControlService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IWorkspaceService _workspaceService;

        public VersionControlService(IServiceScopeFactory scopeFactory, IWorkspaceService workspaceService)
        {
            _scopeFactory = scopeFactory;
            _workspaceService = workspaceService;
        }

        public async Task<ProjectVersion?> CreateSnapshotAsync(int projectId, int userId, string commitMessage, bool isAgent = false)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Fetch current project files
            var files = await dbContext.ProjectFiles
                .Where(f => f.ProjectId == projectId && !f.IsDirectory)
                .ToListAsync();

            // Fetch latest parent version
            var latestVersion = await dbContext.ProjectVersions
                .Include(v => v.Snapshots)
                .Where(v => v.ProjectId == projectId)
                .OrderByDescending(v => v.VersionNumber)
                .FirstOrDefaultAsync();

            var currentFileHashMap = new Dictionary<string, (string content, string hash)>();
            foreach (var f in files)
            {
                string hash = ComputeSha256(f.Content);
                currentFileHashMap[f.RelativePath] = (f.Content, hash);
            }

            // Check if any file content changed compared to parent version
            if (latestVersion != null && latestVersion.Snapshots.Count > 0)
            {
                var parentHashMap = latestVersion.Snapshots.ToDictionary(s => s.FilePath, s => s.FileHash);

                bool hasAnyChanges = false;
                if (currentFileHashMap.Count != parentHashMap.Count)
                {
                    hasAnyChanges = true;
                }
                else
                {
                    foreach (var kvp in currentFileHashMap)
                    {
                        if (!parentHashMap.TryGetValue(kvp.Key, out var parentHash) || parentHash != kvp.Value.hash)
                        {
                            hasAnyChanges = true;
                            break;
                        }
                    }
                }

                if (!hasAnyChanges)
                {
                    // Deduplication: Skip duplicate snapshot creation
                    return latestVersion;
                }
            }

            int newVersionNum = (latestVersion?.VersionNumber ?? 0) + 1;

            var version = new ProjectVersion
            {
                ProjectId = projectId,
                UserId = userId,
                ParentVersionId = latestVersion?.Id,
                VersionNumber = newVersionNum,
                CommitMessage = string.IsNullOrWhiteSpace(commitMessage) ? $"v{newVersionNum} Snapshot" : commitMessage.Trim(),
                CreatedByAgent = isAgent,
                CreatedAt = DateTime.UtcNow
            };

            dbContext.ProjectVersions.Add(version);
            await dbContext.SaveChangesAsync();

            // Create FileSnapshots & FileChangeHistories
            var parentSnapshots = latestVersion?.Snapshots.ToDictionary(s => s.FilePath, s => s) ?? new Dictionary<string, FileSnapshot>();

            foreach (var kvp in currentFileHashMap)
            {
                string relPath = kvp.Key;
                string content = kvp.Value.content;
                string hash = kvp.Value.hash;

                var snapshot = new FileSnapshot
                {
                    ProjectVersionId = version.Id,
                    FilePath = relPath,
                    Content = content,
                    FileHash = hash,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.FileSnapshots.Add(snapshot);

                // Determine Action
                string action = "UPDATE";
                string? oldHash = null;

                if (!parentSnapshots.ContainsKey(relPath))
                {
                    action = "CREATE";
                }
                else
                {
                    oldHash = parentSnapshots[relPath].FileHash;
                    if (oldHash == hash) continue; // No change for this specific file
                }

                dbContext.FileChangeHistories.Add(new FileChangeHistory
                {
                    ProjectVersionId = version.Id,
                    FilePath = relPath,
                    Action = action,
                    OldHash = oldHash,
                    NewHash = hash
                });
            }

            // Detect DELETED files
            foreach (var parentKvp in parentSnapshots)
            {
                if (!currentFileHashMap.ContainsKey(parentKvp.Key))
                {
                    dbContext.FileChangeHistories.Add(new FileChangeHistory
                    {
                        ProjectVersionId = version.Id,
                        FilePath = parentKvp.Key,
                        Action = "DELETE",
                        OldHash = parentKvp.Value.FileHash,
                        NewHash = null
                    });
                }
            }

            await dbContext.SaveChangesAsync();
            return version;
        }

        public async Task<List<ProjectVersion>> GetProjectVersionsAsync(int projectId, int userId)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            return await dbContext.ProjectVersions
                .Where(v => v.ProjectId == projectId)
                .OrderByDescending(v => v.VersionNumber)
                .ToListAsync();
        }

        public async Task<List<VersionDiffItem>> GetVersionDiffsAsync(int versionId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var version = await dbContext.ProjectVersions
                .Include(v => v.Snapshots)
                .FirstOrDefaultAsync(v => v.Id == versionId);

            if (version == null) throw new KeyNotFoundException("Version not found");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(version.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            var parentVersion = version.ParentVersionId.HasValue
                ? await dbContext.ProjectVersions.Include(v => v.Snapshots).FirstOrDefaultAsync(v => v.Id == version.ParentVersionId.Value)
                : null;

            var parentSnapshots = parentVersion?.Snapshots.ToDictionary(s => s.FilePath, s => s.Content) ?? new Dictionary<string, string>();
            var currentSnapshots = version.Snapshots.ToDictionary(s => s.FilePath, s => s.Content);

            var diffs = new List<VersionDiffItem>();

            foreach (var kvp in currentSnapshots)
            {
                string relPath = kvp.Key;
                string newContent = kvp.Value;

                if (!parentSnapshots.TryGetValue(relPath, out var oldContent))
                {
                    diffs.Add(new VersionDiffItem { FilePath = relPath, Action = "CREATE", OldContent = "", NewContent = newContent });
                }
                else if (oldContent != newContent)
                {
                    diffs.Add(new VersionDiffItem { FilePath = relPath, Action = "UPDATE", OldContent = oldContent, NewContent = newContent });
                }
            }

            foreach (var parentKvp in parentSnapshots)
            {
                if (!currentSnapshots.ContainsKey(parentKvp.Key))
                {
                    diffs.Add(new VersionDiffItem { FilePath = parentKvp.Key, Action = "DELETE", OldContent = parentKvp.Value, NewContent = "" });
                }
            }

            return diffs;
        }

        public async Task<ProjectVersion> RestoreVersionAsync(int versionId, int userId, string webRoot)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var targetVersion = await dbContext.ProjectVersions
                .Include(v => v.Snapshots)
                .FirstOrDefaultAsync(v => v.Id == versionId);

            if (targetVersion == null) throw new KeyNotFoundException("Target version not found");

            int projectId = targetVersion.ProjectId;

            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            // Step 1: Backup current workspace state before rollback
            var backupVersion = await CreateSnapshotAsync(projectId, userId, $"Backup state before rollback to v{targetVersion.VersionNumber}", false);

            // Step 2: Overwrite workspace files with target version snapshots
            var targetSnapshots = targetVersion.Snapshots.ToDictionary(s => s.FilePath, s => s.Content);

            // Fetch current DB project files
            var currentFiles = await dbContext.ProjectFiles
                .Where(f => f.ProjectId == projectId && !f.IsDirectory)
                .ToListAsync();

            // Restore/overwrite files
            foreach (var kvp in targetSnapshots)
            {
                await _workspaceService.SaveFileWithVersionAsync(
                    projectId,
                    kvp.Key,
                    kvp.Value,
                    "SYSTEM",
                    $"Rollback restore to v{targetVersion.VersionNumber}",
                    webRoot
                );
            }

            // Remove files that exist in current state but do not exist in target version
            foreach (var currentFile in currentFiles)
            {
                if (!targetSnapshots.ContainsKey(currentFile.RelativePath))
                {
                    await _workspaceService.DeleteItemAsync(projectId, currentFile.RelativePath, webRoot);
                }
            }

            // Step 3: Record new Rollback commit
            var newCommit = await CreateSnapshotAsync(projectId, userId, $"Rollback from v{backupVersion?.VersionNumber ?? 0} to v{targetVersion.VersionNumber}", false);
            return newCommit ?? targetVersion;
        }

        private static string ComputeSha256(string content)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(content ?? string.Empty);
            byte[] hashBytes = SHA256.HashData(bytes);
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }
    }
}
