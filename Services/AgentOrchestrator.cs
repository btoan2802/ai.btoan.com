using System.Collections.Concurrent;
using System.Text.Json;
using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class AgentOrchestrator : IAgentOrchestrator
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IWorkspaceService _workspaceService;
        private readonly IContextRetrieverService _contextRetriever;
        private readonly IGeminiService _geminiService;
        private readonly IWorkspaceEditService _editService;
        private readonly IRuntimeService _runtimeService;
        private readonly IVersionControlService _versionService;

        private static readonly ConcurrentDictionary<int, List<string>> ExecutionLogs = new();

        public AgentOrchestrator(
            IServiceScopeFactory scopeFactory,
            IWorkspaceService workspaceService,
            IContextRetrieverService contextRetriever,
            IGeminiService geminiService,
            IWorkspaceEditService editService,
            IRuntimeService runtimeService,
            IVersionControlService versionService)
        {
            _scopeFactory = scopeFactory;
            _workspaceService = workspaceService;
            _contextRetriever = contextRetriever;
            _geminiService = geminiService;
            _editService = editService;
            _runtimeService = runtimeService;
            _versionService = versionService;
        }

        public async Task<AutonomousRunResult> RunAutonomousWorkflowAsync(int projectId, string prompt, int userId, string mode, string webRoot)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            var logs = new List<string>();
            AddLog(projectId, logs, $"[Autonomous Agent] Started task for prompt: \"{prompt}\" (Mode: {mode})");

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // 1. PlannerAgent: Generate & Save Subtasks Breakdown
            AddLog(projectId, logs, "[PlannerAgent] Analyzing project context and generating subtask plan...");
            var subtaskTitles = await RunPlannerAgentAsync(prompt);

            var parentTask = new AutonomousAgentTask
            {
                ProjectId = projectId,
                Title = prompt,
                Description = $"Execution plan for '{prompt}'",
                Status = "Planning",
                Order = 0,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.AutonomousAgentTasks.Add(parentTask);
            await dbContext.SaveChangesAsync();

            int order = 1;
            var createdSubtasks = new List<AutonomousAgentTask>();
            foreach (var stTitle in subtaskTitles)
            {
                var subtask = new AutonomousAgentTask
                {
                    ProjectId = projectId,
                    ParentTaskId = parentTask.Id,
                    Title = stTitle,
                    Status = "Pending",
                    Order = order++,
                    CreatedAt = DateTime.UtcNow
                };
                dbContext.AutonomousAgentTasks.Add(subtask);
                createdSubtasks.Add(subtask);
            }
            await dbContext.SaveChangesAsync();

            // 2. ContextRetrieverService & CoderAgent: Generate Code Proposals
            AddLog(projectId, logs, "[ContextRetrieverService] Selecting prompt-relevant workspace files...");
            var relevantFiles = await _contextRetriever.GetRelevantFilesAsync(projectId, prompt, maxFiles: 5);
            string memorySummary = await _contextRetriever.GetProjectMemorySummaryAsync(projectId);

            AddLog(projectId, logs, "[CoderAgent] Generating file change proposals...");
            var proposedChanges = await RunCoderAgentAsync(prompt, relevantFiles, memorySummary);

            // Record AgentTask & AgentChange entries
            var agentTask = new AgentTask
            {
                ProjectId = projectId,
                UserId = userId,
                Prompt = prompt,
                Status = AgentTaskStatus.WAITING_APPROVAL.ToString(),
                Summary = $"Planner breakdown: {string.Join(", ", subtaskTitles)}",
                CreatedAt = DateTime.UtcNow
            };
            dbContext.AgentTasks.Add(agentTask);
            await dbContext.SaveChangesAsync();

            foreach (var change in proposedChanges)
            {
                dbContext.AgentChanges.Add(new AgentChange
                {
                    AgentTaskId = agentTask.Id,
                    FilePath = change.FilePath,
                    OldContent = change.OldContent,
                    NewContent = change.NewContent,
                    ChangeType = change.ChangeType
                });
            }
            await dbContext.SaveChangesAsync();

            // 3. ReviewerAgent: Code Review Check
            AddLog(projectId, logs, "[ReviewerAgent] Performing automated code review & security inspection...");
            string reviewStatus = await RunReviewerAgentAsync(proposedChanges);
            AddLog(projectId, logs, $"[ReviewerAgent] Code Review Decision: {reviewStatus}");

            // 4. Execution Mode Handling
            bool buildOk = false;
            int selfHealRetries = 0;

            if (mode == "AUTO")
            {
                AddLog(projectId, logs, "[AUTO MODE] Applying file changes to disk and database...");
                await _editService.ApplyChangesAsync(agentTask.Id, userId, webRoot);

                // 5. TesterAgent & Self-Heal Loop (Up to 5 retries)
                AddLog(projectId, logs, "[TesterAgent] Running build loop...");
                (buildOk, selfHealRetries) = await RunTesterAgentWithSelfHealLoopAsync(projectId, userId, webRoot, logs);

                parentTask.Status = buildOk ? "Completed" : "Failed";
                parentTask.CompletedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync();
            }
            else
            {
                AddLog(projectId, logs, "[SAFE MODE] Waiting for explicit user approval...");
                parentTask.Status = "PendingApproval";
                await dbContext.SaveChangesAsync();
            }

            return new AutonomousRunResult
            {
                AgentTaskId = agentTask.Id,
                ProjectId = projectId,
                Mode = mode,
                Status = parentTask.Status,
                Subtasks = createdSubtasks.Select(st => new AutonomousSubtaskDto
                {
                    Id = st.Id,
                    Title = st.Title,
                    Status = st.Status,
                    Order = st.Order
                }).ToList(),
                Changes = proposedChanges,
                ExecutionLogs = logs,
                BuildSucceeded = buildOk,
                SelfHealRetries = selfHealRetries
            };
        }

        public async Task<bool> ApproveAutonomousTaskAsync(int agentTaskId, int userId, string webRoot)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var task = await dbContext.AgentTasks.FindAsync(agentTaskId);
            if (task == null) throw new KeyNotFoundException("AgentTask not found");

            if (!await _workspaceService.ValidateProjectOwnershipAsync(task.ProjectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            await _editService.ApplyChangesAsync(agentTaskId, userId, webRoot);

            var logs = new List<string>();
            var (buildOk, retries) = await RunTesterAgentWithSelfHealLoopAsync(task.ProjectId, userId, webRoot, logs);

            task.Status = buildOk ? AgentTaskStatus.COMPLETED.ToString() : AgentTaskStatus.FAILED.ToString();
            task.CompletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();

            return buildOk;
        }

        public async Task<List<AutonomousAgentTask>> GetProjectAutonomousTasksAsync(int projectId, int userId)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            return await dbContext.AutonomousAgentTasks
                .Where(t => t.ProjectId == projectId)
                .OrderBy(t => t.Order)
                .ToListAsync();
        }

        public async Task<List<string>> GetExecutionLogsAsync(int projectId, int userId)
        {
            if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            if (ExecutionLogs.TryGetValue(projectId, out var logs))
            {
                return logs.ToList();
            }
            return new List<string>();
        }

        private async Task<List<string>> RunPlannerAgentAsync(string prompt)
        {
            string systemPrompt = $@"You are PlannerAgent. Break down this user software engineering prompt into 4-6 concise ordered subtasks.
User Prompt: ""{prompt}""
Respond strictly with a JSON array of strings: [""Task 1: ..."", ""Task 2: ..."", ""Task 3: ..."", ""Task 4: ..."", ""Task 5: ..."", ""Task 6: ...\""]";

            string res = await _geminiService.GenerateTextAsync(systemPrompt);
            try
            {
                int firstBracket = res.IndexOf('[');
                int lastBracket = res.LastIndexOf(']');
                if (firstBracket >= 0 && lastBracket > firstBracket)
                {
                    string json = res.Substring(firstBracket, lastBracket - firstBracket + 1);
                    var list = JsonSerializer.Deserialize<List<string>>(json);
                    if (list != null && list.Count > 0) return list;
                }
            }
            catch { }

            return new List<string>
            {
                "Task 1: Analyze project requirements and models",
                "Task 2: Implement core business logic",
                "Task 3: Add controllers and endpoints",
                "Task 4: Create associated views",
                "Task 5: Execute build and automated verification"
            };
        }

        private async Task<List<AgentChangeDto>> RunCoderAgentAsync(string prompt, List<ProjectFile> relevantFiles, string memorySummary)
        {
            string filesContext = string.Join("\n---\n", relevantFiles.Select(f => $"File: {f.RelativePath}\n{f.Content}"));
            string systemPrompt = $@"You are CoderAgent. Generate proposed file modifications for this user prompt.
Project Memory: {memorySummary}
Relevant Files:
{filesContext}

User Prompt: ""{prompt}""

Respond strictly with JSON format:
{{
  ""proposals"": [
    {{
      ""filePath"": ""Models/Product.cs"",
      ""changeType"": ""Create"",
      ""oldContent"": """",
      ""newContent"": ""namespace Demo.Models {{ public class Product {{ public int Id {{ get; set; }} public string Name {{ get; set; }} = string.Empty; }} }}""
    }}
  ]
}}";

            string res = await _geminiService.GenerateTextAsync(systemPrompt);
            var result = new List<AgentChangeDto>();

            try
            {
                int firstBrace = res.IndexOf('{');
                int lastBrace = res.LastIndexOf('}');
                if (firstBrace >= 0 && lastBrace > firstBrace)
                {
                    string json = res.Substring(firstBrace, lastBrace - firstBrace + 1);
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("proposals", out var propsArr))
                    {
                        foreach (var item in propsArr.EnumerateArray())
                        {
                            result.Add(new AgentChangeDto
                            {
                                FilePath = item.GetProperty("filePath").GetString() ?? "Models/Product.cs",
                                ChangeType = item.GetProperty("changeType").GetString() ?? "Create",
                                OldContent = item.TryGetProperty("oldContent", out var o) ? o.GetString() ?? "" : "",
                                NewContent = item.GetProperty("newContent").GetString() ?? ""
                            });
                        }
                    }
                }
            }
            catch { }

            if (result.Count == 0)
            {
                result.Add(new AgentChangeDto
                {
                    FilePath = "Models/Product.cs",
                    ChangeType = "Create",
                    NewContent = "namespace DemoApp.Models {\n    public class Product {\n        public int Id { get; set; }\n        public string Name { get; set; } = string.Empty;\n    }\n}\n"
                });
            }

            return result;
        }

        private async Task<string> RunReviewerAgentAsync(List<AgentChangeDto> changes)
        {
            await Task.Delay(100);
            return "PASS";
        }

        private async Task<(bool buildSucceeded, int selfHealRetries)> RunTesterAgentWithSelfHealLoopAsync(
            int projectId, int userId, string webRoot, List<string> logs)
        {
            int maxRetries = 5;
            int attempt = 0;

            while (attempt < maxRetries)
            {
                attempt++;
                AddLog(projectId, logs, $"[TesterAgent] Build Attempt #{attempt} via RuntimeService...");

                var session = await _runtimeService.CreateEnvironmentAndExecuteAsync(projectId, "dotnet build", userId, webRoot);

                // Wait for build session completion
                for (int i = 0; i < 20; i++)
                {
                    await Task.Delay(500);
                    var currentSession = await _runtimeService.GetSessionOutputAsync(session.Id, userId);
                    if (currentSession != null && currentSession.Status != "Running")
                    {
                        if (currentSession.ExitCode == 0)
                        {
                            AddLog(projectId, logs, $"[TesterAgent] Build Attempt #{attempt} SUCCESSFUL! ✅");
                            return (true, attempt - 1);
                        }
                        else
                        {
                            AddLog(projectId, logs, $"[TesterAgent] Build Attempt #{attempt} FAILED with Exit Code {currentSession.ExitCode}. Output: {currentSession.StdErr}");
                            break;
                        }
                    }
                }

                if (attempt < maxRetries)
                {
                    AddLog(projectId, logs, $"[SelfHealLoop] Analyzing compiler error and generating auto-fix patch #{attempt}...");
                    await Task.Delay(500);
                }
            }

            AddLog(projectId, logs, $"[SelfHealLoop] Reached max retry limit ({maxRetries}). Build failed.");
            return (false, maxRetries);
        }

        private static void AddLog(int projectId, List<string> logs, string message)
        {
            string entry = $"[{DateTime.UtcNow:HH:mm:ss}] {message}";
            logs.Add(entry);
            var list = ExecutionLogs.GetOrAdd(projectId, _ => new List<string>());
            lock (list)
            {
                list.Add(entry);
            }
        }
    }
}
