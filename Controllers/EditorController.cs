using BtoanAiNet.Data;
using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    [Route("api/editor")]
    public class EditorController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWorkspaceService _workspaceService;
        private readonly IFileEditorService _editorService;
        private readonly IWebHostEnvironment _env;

        public EditorController(
            AppDbContext context,
            IWorkspaceService workspaceService,
            IFileEditorService editorService,
            IWebHostEnvironment env)
        {
            _context = context;
            _workspaceService = workspaceService;
            _editorService = editorService;
            _env = env;
        }

        // GET /api/editor/file/{fileId}
        [HttpGet("file/{fileId}")]
        public async Task<IActionResult> GetFileById(int fileId, [FromQuery] int userId = 0)
        {
            try
            {
                var pFile = await _context.ProjectFiles.FindAsync(fileId);
                if (pFile == null) return NotFound(new { ok = false, error = "File not found" });

                if (!await _workspaceService.ValidateProjectOwnershipAsync(pFile.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                string targetDir = await _workspaceService.GetProjectStoragePathAsync(pFile.ProjectId, webRoot);
                string content = await _editorService.ReadFileContentAsync(targetDir, pFile.RelativePath);

                return Ok(new
                {
                    ok = true,
                    id = pFile.Id,
                    projectId = pFile.ProjectId,
                    relativePath = pFile.RelativePath,
                    name = Path.GetFileName(pFile.RelativePath),
                    language = pFile.Language ?? DetectLanguage(pFile.RelativePath),
                    content = content
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // PUT /api/editor/file/save
        [HttpPut("file/save")]
        public async Task<IActionResult> SaveFile([FromBody] SaveEditorFileRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null) return BadRequest(new { ok = false, error = "Invalid model" });

            try
            {
                int projectId = model.ProjectId;
                string relativePath = model.Path;

                if (model.FileId > 0)
                {
                    var pFile = await _context.ProjectFiles.FindAsync(model.FileId);
                    if (pFile != null)
                    {
                        projectId = pFile.ProjectId;
                        relativePath = pFile.RelativePath;
                    }
                }

                if (projectId <= 0 || string.IsNullOrWhiteSpace(relativePath))
                    return BadRequest(new { ok = false, error = "ProjectId and Path are required" });

                if (!await _workspaceService.ValidateProjectOwnershipAsync(projectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string webRoot = GetWebRoot();
                await _workspaceService.SaveFileWithVersionAsync(projectId, relativePath, model.Content ?? "", "USER", "Editor manual save", webRoot);

                var updatedFile = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == relativePath);

                return Ok(new
                {
                    ok = true,
                    message = "File saved and version recorded",
                    fileId = updatedFile?.Id ?? model.FileId,
                    projectId = projectId,
                    relativePath = relativePath,
                    updatedAt = DateTime.UtcNow.ToString("HH:mm:ss dd/MM/yyyy")
                });
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

    public class SaveEditorFileRequestModel
    {
        public int FileId { get; set; }
        public int ProjectId { get; set; }
        public string Path { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }
}
