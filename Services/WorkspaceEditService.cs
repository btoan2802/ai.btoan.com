using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class WorkspaceEditService : IWorkspaceEditService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IWorkspaceService _workspaceService;
        private readonly IVersionControlService _versionService;

        public WorkspaceEditService(
            IServiceScopeFactory scopeFactory,
            IWorkspaceService workspaceService,
            IVersionControlService versionService)
        {
            _scopeFactory = scopeFactory;
            _workspaceService = workspaceService;
            _versionService = versionService;
        }

        public async Task<bool> ApplyChangesAsync(int taskId, int userId, string webRoot)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks
                .Include(t => t.Changes)
                .FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null) throw new KeyNotFoundException("AgentTask not found");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (task.Status != AgentTaskStatus.WAITING_APPROVAL.ToString())
                throw new InvalidOperationException($"Cannot apply changes. Task is in state '{task.Status}'.");

            task.Status = AgentTaskStatus.APPLYING_CHANGES.ToString();
            await dbContext.SaveChangesAsync();

            foreach (var change in task.Changes)
            {
                if (change.ChangeType == "Delete")
                {
                    await _workspaceService.DeleteItemAsync(task.ProjectId, change.FilePath, webRoot);
                }
                else
                {
                    await _workspaceService.SaveFileWithVersionAsync(
                        task.ProjectId,
                        change.FilePath,
                        change.NewContent,
                        "AGENT",
                        $"Applied Agent proposal for task #{taskId}: {task.Prompt}",
                        webRoot
                    );
                }
            }

            // AUTO-COMMIT: Create Git-like ProjectVersion snapshot after AI applies code
            await _versionService.CreateSnapshotAsync(task.ProjectId, userId, $"AI: {task.Prompt}", isAgent: true);

            task.Status = AgentTaskStatus.BUILDING.ToString();
            await dbContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RejectChangesAsync(int taskId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks.FindAsync(taskId);
            if (task == null) throw new KeyNotFoundException("AgentTask not found");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            task.Status = AgentTaskStatus.FAILED.ToString();
            task.CompletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return true;
        }
    }
}
