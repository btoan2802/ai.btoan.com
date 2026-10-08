using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    public class AgentController : Controller
    {
        private readonly IAgentService _agentService;
        private readonly IProjectScannerService _scannerService;
        private readonly IFileEditorService _editorService;
        private readonly IWorkspaceService _workspaceService;
        private readonly ITerminalExecutionService _terminalService;
        private readonly IAgentWorkflowService _workflowService;
        private readonly IWorkspaceEditService _editService;
        private readonly IWebHostEnvironment _env;

        public AgentController(
            IAgentService agentService,
            IProjectScannerService scannerService,
            IFileEditorService editorService,
            IWorkspaceService workspaceService,
            ITerminalExecutionService terminalService,
            IAgentWorkflowService workflowService,
            IWorkspaceEditService editService,
            IWebHostEnvironment env)
        {
            _agentService = agentService;
            _scannerService = scannerService;
            _editorService = editorService;
            _workspaceService = workspaceService;
            _terminalService = terminalService;
            _workflowService = workflowService;
            _editService = editService;
            _env = env;
        }

        // GET /agent
        [HttpGet("agent")]
        public IActionResult Index()
        {
            return View();
        }

        // GET /ai/api/agent/projects
        [HttpGet]
        [Route("ai/api/agent/projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int user_id)
        {
            try
            {
                var projects = await _workspaceService.GetUserProjectsAsync(user_id);
                return Json(new { ok = true, projects });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // DELETE /ai/api/agent/projects/{id}
        [HttpDelete]
        [Route("ai/api/agent/projects/{id}")]
        public async Task<IActionResult> DeleteProject(int id, [FromQuery] int user_id)
        {
            try
            {
                string webRoot = GetWebRoot();
                bool deleted = await _workspaceService.DeleteProjectAsync(id, user_id, webRoot);
                return Json(new { ok = deleted, message = deleted ? "Project deleted successfully" : "Project not found" });
            }
            catch (UnauthorizedAccessException uex)
            {
                return Json(new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // GET /ai/api/agent/projects/{id}/export-zip
        [HttpGet]
        [Route("ai/api/agent/projects/{id}/export-zip")]
        public async Task<IActionResult> ExportZip(int id, [FromQuery] int user_id)
        {
            try
            {
                string webRoot = GetWebRoot();
                var bytes = await _workspaceService.ExportProjectAsZipAsync(id, user_id, webRoot);
                return File(bytes, "application/zip", $"Project_{id}_Workspace.zip");
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/projects/create
        [HttpPost]
        [Route("ai/api/agent/projects/create")]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectRequestModel model)
        {
            if (model == null) return Json(new { ok = false, error = "Invalid model" });
            try
            {
                string webRoot = GetWebRoot();
                var project = await _workspaceService.CreateProjectAsync(model.UserId, model.Name, model.Template, webRoot);
                return Json(new { ok = true, project });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/projects/upload-zip
        [HttpPost]
        [Route("ai/api/agent/projects/upload-zip")]
        public async Task<IActionResult> UploadZip([FromForm] int userId, [FromForm] string name, IFormFile file)
        {
            if (file == null || file.Length == 0) return Json(new { ok = false, error = "No file uploaded" });
            try
            {
                string webRoot = GetWebRoot();
                using var stream = file.OpenReadStream();
                var project = await _workspaceService.CreateProjectFromZipAsync(userId, name, stream, webRoot);
                return Json(new { ok = true, project });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/projects/import-git
        [HttpPost]
        [Route("ai/api/agent/projects/import-git")]
        public async Task<IActionResult> ImportGit([FromBody] ImportGitRequestModel model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.GitUrl)) return Json(new { ok = false, error = "Git URL is required" });
            try
            {
                string webRoot = GetWebRoot();
                var project = await _workspaceService.CreateProjectFromGitAsync(model.UserId, model.Name, model.GitUrl, webRoot);
                return Json(new { ok = true, project });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // GET /ai/api/agent/tree
        [HttpGet]
        [Route("ai/api/agent/tree")]
        public async Task<IActionResult> GetTree([FromQuery] int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
                var tree = await _scannerService.GetProjectTreeAsync(targetDir);
                return Json(new { ok = true, tree });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // GET /ai/api/agent/file
        [HttpGet]
        [Route("ai/api/agent/file")]
        public async Task<IActionResult> GetFile([FromQuery] int projectId, [FromQuery] string path, [FromQuery] int userId = 0)
        {
            if (string.IsNullOrWhiteSpace(path)) return Json(new { ok = false, error = "Path is required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
                string content = await _editorService.ReadFileContentAsync(targetDir, path);
                return Json(new { ok = true, projectId, path, content });
            }
            catch (UnauthorizedAccessException uex)
            {
                return BadRequest(new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/file/save
        [HttpPost]
        [Route("ai/api/agent/file/save")]
        public async Task<IActionResult> SaveFile([FromBody] SaveWorkspaceFileRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Path)) return Json(new { ok = false, error = "Invalid model" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.SaveFileWithVersionAsync(model.ProjectId, model.Path, model.Content ?? "", "USER", "User manual save", webRoot);
                return Json(new { ok = true, message = "File saved and version recorded" });
            }
            catch (UnauthorizedAccessException uex)
            {
                return BadRequest(new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/file/create-item
        [HttpPost]
        [Route("ai/api/agent/file/create-item")]
        public async Task<IActionResult> CreateItem([FromBody] CreateItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Path)) return Json(new { ok = false, error = "Path is required" });
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.CreateItemAsync(model.ProjectId, model.Path, model.IsDirectory, webRoot);
                return Json(new { ok = true });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/file/rename-item
        [HttpPost]
        [Route("ai/api/agent/file/rename-item")]
        public async Task<IActionResult> RenameItem([FromBody] RenameItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.OldPath) || string.IsNullOrWhiteSpace(model.NewPath))
                return Json(new { ok = false, error = "Old and new paths are required" });
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.RenameItemAsync(model.ProjectId, model.OldPath, model.NewPath, webRoot);
                return Json(new { ok = true });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/file/delete-item
        [HttpPost]
        [Route("ai/api/agent/file/delete-item")]
        public async Task<IActionResult> DeleteItem([FromBody] DeleteItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Path)) return Json(new { ok = false, error = "Path is required" });
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.DeleteItemAsync(model.ProjectId, model.Path, webRoot);
                return Json(new { ok = true });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/terminal/execute
        [HttpPost]
        [Route("ai/api/agent/terminal/execute")]
        public async Task<IActionResult> ExecuteTerminalCommand([FromBody] ExecuteTerminalRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Command))
                return Json(new { ok = false, error = "Command is required" });
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(model.ProjectId, webRoot);
                var result = await _terminalService.ExecuteCommandAsync(targetDir, model.Command);
                return Json(new { ok = true, result });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // GET /ai/api/agent/file/versions
        [HttpGet]
        [Route("ai/api/agent/file/versions")]
        public async Task<IActionResult> GetFileVersions([FromQuery] int projectId, [FromQuery] string path, [FromQuery] int userId = 0)
        {
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                var versions = await _workspaceService.GetFileVersionHistoryAsync(projectId, path);
                var result = versions.Select(v => new
                {
                    id = v.Id,
                    versionNumber = v.VersionNumber,
                    createdBy = v.CreatedBy,
                    changeSummary = v.ChangeSummary,
                    createdAt = v.CreatedAt.ToString("HH:mm:ss dd/MM/yyyy")
                });
                return Json(new { ok = true, versions = result });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/file/rollback
        [HttpPost]
        [Route("ai/api/agent/file/rollback")]
        public async Task<IActionResult> Rollback([FromBody] RollbackRequestModel model, [FromQuery] int userId = 0)
        {
            try
            {
                string webRoot = GetWebRoot();
                bool success = await _workspaceService.RollbackFileVersionAsync(model.VersionId, webRoot);
                return Json(new { ok = success });
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // POST /ai/api/agent/analyze
        [HttpPost]
        [Route("ai/api/agent/analyze")]
        public async Task<IActionResult> Analyze([FromBody] AgentTaskRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Prompt))
                return BadRequest(new { ok = false, error = "Yêu cầu không hợp lệ" });

            if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

            string webRoot = GetWebRoot();
            var response = await _agentService.AnalyzeAndProposeAsync(model, webRoot);
            return Ok(response);
        }

        // POST /ai/api/agent/apply
        [HttpPost]
        [Route("ai/api/agent/apply")]
        public async Task<IActionResult> Apply([FromBody] AgentApplyRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ApprovedProposals == null)
                return BadRequest(new { ok = false, error = "Không có thay đổi nào được duyệt" });

            if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

            string webRoot = GetWebRoot();
            var response = await _agentService.ApplyAndBuildAsync(model, webRoot);
            return Ok(response);
        }

        // POST /api/agent/task/create
        [HttpPost]
        [Route("api/agent/task/create")]
        public async Task<IActionResult> CreateWorkflowTask([FromBody] AgentTaskRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Prompt))
                return BadRequest(new { ok = false, error = "Prompt and ProjectId are required" });

            try
            {
                string webRoot = GetWebRoot();
                var task = await _workflowService.CreateTaskAndAnalyzeAsync(model.ProjectId, model.Prompt, userId, webRoot);
                return Ok(new
                {
                    ok = true,
                    taskId = task.Id,
                    projectId = task.ProjectId,
                    status = task.Status,
                    summary = task.Summary,
                    createdAt = task.CreatedAt
                });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // GET /api/agent/task/{id}
        [HttpGet]
        [Route("api/agent/task/{id}")]
        public async Task<IActionResult> GetTaskDetails(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var task = await _workflowService.GetTaskDetailsAsync(id, userId);
                if (task == null) return NotFound(new { ok = false, error = "Task not found" });

                return Ok(new
                {
                    ok = true,
                    taskId = task.Id,
                    projectId = task.ProjectId,
                    prompt = task.Prompt,
                    status = task.Status,
                    summary = task.Summary,
                    createdAt = task.CreatedAt,
                    completedAt = task.CompletedAt,
                    messages = task.Messages.Select(m => new { m.Role, m.Content, m.CreatedAt }),
                    changesCount = task.Changes.Count
                });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // GET /api/agent/task/{id}/changes
        [HttpGet]
        [Route("api/agent/task/{id}/changes")]
        public async Task<IActionResult> GetTaskChanges(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var changes = await _workflowService.GetTaskChangesAsync(id, userId);
                return Ok(new
                {
                    ok = true,
                    changes = changes.Select(c => new
                    {
                        c.Id,
                        file = c.FilePath,
                        oldContent = c.OldContent,
                        newContent = c.NewContent,
                        changeType = c.ChangeType
                    })
                });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/agent/task/{id}/approve
        [HttpPost]
        [Route("api/agent/task/{id}/approve")]
        public async Task<IActionResult> ApproveTaskChanges(int id, [FromQuery] int userId = 0)
        {
            try
            {
                string webRoot = GetWebRoot();
                bool applied = await _editService.ApplyChangesAsync(id, userId, webRoot);
                if (!applied) return BadRequest(new { ok = false, error = "Failed to apply changes" });

                // Run Build Loop Automatically
                bool buildOk = await _workflowService.ProcessBuildLoopAsync(id, userId, webRoot);

                return Ok(new
                {
                    ok = true,
                    message = buildOk ? "Changes applied and build succeeded!" : "Changes applied but build failed.",
                    buildSucceeded = buildOk
                });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/agent/task/{id}/reject
        [HttpPost]
        [Route("api/agent/task/{id}/reject")]
        public async Task<IActionResult> RejectTaskChanges(int id, [FromQuery] int userId = 0)
        {
            try
            {
                bool rejected = await _editService.RejectChangesAsync(id, userId);
                return Ok(new { ok = true, message = "Task changes rejected." });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        private string GetWebRoot()
        {
            return _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }
    }
}
