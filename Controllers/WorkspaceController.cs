using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    [Route("api/workspace")]
    public class WorkspaceController : ControllerBase
    {
        private readonly IWorkspaceService _workspaceService;
        private readonly IProjectScannerService _scannerService;
        private readonly IFileEditorService _editorService;
        private readonly IWebHostEnvironment _env;

        public WorkspaceController(
            IWorkspaceService workspaceService,
            IProjectScannerService scannerService,
            IFileEditorService editorService,
            IWebHostEnvironment env)
        {
            _workspaceService = workspaceService;
            _scannerService = scannerService;
            _editorService = editorService;
            _env = env;
        }

        // GET /api/workspace/{projectId}/tree
        [HttpGet("{projectId}/tree")]
        public async Task<IActionResult> GetTree(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
                var tree = await _scannerService.GetProjectTreeAsync(targetDir);
                return Ok(new { ok = true, tree });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // GET /api/workspace/file
        [HttpGet("file")]
        public async Task<IActionResult> GetFile([FromQuery] int projectId, [FromQuery] string path, [FromQuery] int userId = 0)
        {
            if (string.IsNullOrWhiteSpace(path)) return BadRequest(new { ok = false, error = "Path is required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(projectId, webRoot);
                string content = await _editorService.ReadFileContentAsync(targetDir, path);
                return Ok(new { ok = true, projectId, path, content, language = DetectLanguage(path) });
            }
            catch (UnauthorizedAccessException uex)
            {
                return BadRequest(new { ok = false, error = uex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/workspace/file/create
        [HttpPost("file/create")]
        public async Task<IActionResult> CreateFile([FromBody] CreateItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Path)) return BadRequest(new { ok = false, error = "Path is required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.CreateItemAsync(model.ProjectId, model.Path, false, webRoot);
                return Ok(new { ok = true, message = "File created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/workspace/folder/create
        [HttpPost("folder/create")]
        public async Task<IActionResult> CreateFolder([FromBody] CreateItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Path)) return BadRequest(new { ok = false, error = "Path is required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.CreateItemAsync(model.ProjectId, model.Path, true, webRoot);
                return Ok(new { ok = true, message = "Folder created successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // PUT /api/workspace/file/rename
        [HttpPut("file/rename")]
        public async Task<IActionResult> RenameFile([FromBody] RenameItemRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.OldPath) || string.IsNullOrWhiteSpace(model.NewPath))
                return BadRequest(new { ok = false, error = "Old and new paths are required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(model.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.RenameItemAsync(model.ProjectId, model.OldPath, model.NewPath, webRoot);
                return Ok(new { ok = true, message = "Item renamed successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // DELETE /api/workspace/file/delete
        [HttpDelete("file/delete")]
        public async Task<IActionResult> DeleteFile([FromQuery] int projectId, [FromQuery] string path, [FromBody] DeleteItemRequestModel? model, [FromQuery] int userId = 0)
        {
            int targetProjectId = model?.ProjectId > 0 ? model.ProjectId : projectId;
            string targetPath = !string.IsNullOrWhiteSpace(model?.Path) ? model.Path : path;

            if (targetProjectId <= 0 || string.IsNullOrWhiteSpace(targetPath)) 
                return BadRequest(new { ok = false, error = "ProjectId and Path are required" });

            try
            {
                if (!await _workspaceService.ValidateProjectOwnershipAsync(targetProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.DeleteItemAsync(targetProjectId, targetPath, webRoot);
                return Ok(new { ok = true, message = "Item deleted successfully" });
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

        private string DetectLanguage(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            return ext switch
            {
                ".cs" => "csharp",
                ".js" or ".jsx" => "javascript",
                ".ts" or ".tsx" => "typescript",
                ".html" or ".cshtml" => "html",
                ".css" => "css",
                ".sql" => "sql",
                ".py" => "python",
                ".json" => "json",
                _ => "plaintext"
            };
        }
    }
}
