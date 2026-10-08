using System.Text.Json;
using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class AgentWorkflowService : IAgentWorkflowService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IWorkspaceService _workspaceService;
        private readonly IProjectScannerService _scannerService;
        private readonly IGeminiService _geminiService;
        private readonly IRuntimeService _runtimeService;

        public AgentWorkflowService(
            IServiceScopeFactory scopeFactory,
            IWorkspaceService workspaceService,
            IProjectScannerService scannerService,
            IGeminiService geminiService,
            IRuntimeService runtimeService)
        {
            _scopeFactory = scopeFactory;
            _workspaceService = workspaceService;
            _scannerService = scannerService;
            _geminiService = geminiService;
            _runtimeService = runtimeService;
        }

        public async Task<AgentTask> CreateTaskAndAnalyzeAsync(int projectId, string prompt, int userId, string webRoot)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // 1. Create AgentTask Entity
            var task = new AgentTask
            {
                ProjectId = projectId,
                UserId = userId,
                Prompt = prompt.Trim(),
                Status = AgentTaskStatus.ANALYZING.ToString(),
                CreatedAt = DateTime.UtcNow
            };

            dbContext.AgentTasks.Add(task);
            await dbContext.SaveChangesAsync();

            // Record initial User message
            dbContext.AgentMessages.Add(new AgentMessage
            {
                AgentTaskId = task.Id,
                Role = "user",
                Content = prompt
            });
            await dbContext.SaveChangesAsync();

            // 2. Scan Workspace Structure
            string targetDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
            var tree = await _scannerService.GetProjectTreeAsync(targetDir);
            string treeJson = JsonSerializer.Serialize(tree, new JsonSerializerOptions { WriteIndented = false });

            // 3. AI Plan & Proposed Code Changes Generation
            task.Status = AgentTaskStatus.PLANNING.ToString();
            await dbContext.SaveChangesAsync();

            string systemPrompt = $@"You are a Senior AI Agent Architect. Analyze this project structure and user prompt.
Project Tree: {treeJson}
User Prompt: ""{prompt}""

Respond strictly with a JSON object format:
{{
  ""summary"": ""Step-by-step execution plan description..."",
  ""proposals"": [
    {{
      ""relativePath"": ""Models/Product.cs"",
      ""actionType"": ""Create"",
      ""originalContent"": """",
      ""proposedContent"": ""namespace Demo.Models {{ public class Product {{ public int Id {{ get; set; }} public string Name {{ get; set; }} = string.Empty; }} }}""
    }}
  ]
}}";

            string aiResponse = await _geminiService.GenerateTextAsync(systemPrompt);
            var parsed = ParseAiJsonProposal(aiResponse, prompt);

            task.Summary = parsed.summary;

            // Save AI System Message
            dbContext.AgentMessages.Add(new AgentMessage
            {
                AgentTaskId = task.Id,
                Role = "assistant",
                Content = parsed.summary
            });

            // Record Proposed AgentChange entries without modifying real files!
            foreach (var prop in parsed.proposals)
            {
                string oldContent = string.Empty;
                var existingFile = await dbContext.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == prop.relativePath);
                if (existingFile != null)
                {
                    oldContent = existingFile.Content;
                }

                dbContext.AgentChanges.Add(new AgentChange
                {
                    AgentTaskId = task.Id,
                    FilePath = prop.relativePath,
                    OldContent = oldContent,
                    NewContent = prop.proposedContent,
                    ChangeType = prop.actionType
                });
            }

            // Transition status to WAITING_APPROVAL
            task.Status = AgentTaskStatus.WAITING_APPROVAL.ToString();
            await dbContext.SaveChangesAsync();

            return task;
        }

        public async Task<AgentTask?> GetTaskDetailsAsync(int taskId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks
                .Include(t => t.Messages)
                .Include(t => t.Changes)
                .FirstOrDefaultAsync(t => t.Id == taskId);

            if (task == null) return null;

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            return task;
        }

        public async Task<List<AgentChange>> GetTaskChangesAsync(int taskId, int userId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks.FindAsync(taskId);
            if (task == null) throw new KeyNotFoundException("AgentTask not found");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            return await dbContext.AgentChanges.Where(c => c.AgentTaskId == taskId).ToListAsync();
        }

        public async Task<bool> ProcessBuildLoopAsync(int taskId, int userId, string webRoot)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks.FindAsync(taskId);
            if (task == null) return false;

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            task.Status = AgentTaskStatus.BUILDING.ToString();
            await dbContext.SaveChangesAsync();

            var session = await _runtimeService.CreateEnvironmentAndExecuteAsync(task.ProjectId, "dotnet build", userId, webRoot);

            // Wait for build session completion
            for (int i = 0; i < 30; i++)
            {
                await Task.Delay(500);
                var currentSession = await _runtimeService.GetSessionOutputAsync(session.Id, userId);
                if (currentSession != null && currentSession.Status != "Running")
                {
                    using var updateScope = _scopeFactory.CreateScope();
                    var updateDbContext = updateScope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var currentTask = await updateDbContext.AgentTasks.FindAsync(taskId);

                    if (currentTask != null)
                    {
                        if (currentSession.ExitCode == 0)
                        {
                            currentTask.Status = AgentTaskStatus.COMPLETED.ToString();
                            currentTask.CompletedAt = DateTime.UtcNow;
                            await updateDbContext.SaveChangesAsync();
                            return true;
                        }
                        else
                        {
                            currentTask.Status = AgentTaskStatus.FAILED.ToString();
                            currentTask.CompletedAt = DateTime.UtcNow;
                            await updateDbContext.SaveChangesAsync();
                            return false;
                        }
                    }
                }
            }

            using var scopeFinish = _scopeFactory.CreateScope();
            var finishDbContext = scopeFinish.ServiceProvider.GetRequiredService<AppDbContext>();
            var finishTask = await finishDbContext.AgentTasks.FindAsync(taskId);
            if (finishTask != null)
            {
                finishTask.Status = AgentTaskStatus.COMPLETED.ToString();
                finishTask.CompletedAt = DateTime.UtcNow;
                await finishDbContext.SaveChangesAsync();
            }

            return true;
        }

        private (string summary, List<ParsedProposal> proposals) ParseAiJsonProposal(string response, string originalPrompt)
        {
            try {
                int firstBrace = response.IndexOf('{');
                int lastBrace = response.LastIndexOf('}');
                if (firstBrace >= 0 && lastBrace > firstBrace)
                {
                    string json = response.Substring(firstBrace, lastBrace - firstBrace + 1);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    string summary = root.GetProperty("summary").GetString() ?? "Execution Plan";

                    var proposals = new List<ParsedProposal>();
                    if (root.TryGetProperty("proposals", out var propsArr) && propsArr.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in propsArr.EnumerateArray())
                        {
                            proposals.Add(new ParsedProposal
                            {
                                relativePath = item.GetProperty("relativePath").GetString() ?? "Models/NewItem.cs",
                                actionType = item.GetProperty("actionType").GetString() ?? "Create",
                                originalContent = item.TryGetProperty("originalContent", out var orig) ? orig.GetString() ?? "" : "",
                                proposedContent = item.GetProperty("proposedContent").GetString() ?? ""
                            });
                        }
                    }
                    return (summary, proposals);
                }
            } catch { }

            // Fallback Proposal
            return (
                $"Agent Execution Plan for: '{originalPrompt}'",
                new List<ParsedProposal>
                {
                    new ParsedProposal
                    {
                        relativePath = "Models/Product.cs",
                        actionType = "Create",
                        proposedContent = "namespace DemoApp.Models {\n    public class Product {\n        public int Id { get; set; }\n        public string Name { get; set; } = string.Empty;\n        public decimal Price { get; set; }\n    }\n}\n"
                    }
                }
            );
        }

        private class ParsedProposal
        {
            public string relativePath { get; set; } = string.Empty;
            public string actionType { get; set; } = "Create";
            public string originalContent { get; set; } = string.Empty;
            public string proposedContent { get; set; } = string.Empty;
        }
    }
}
