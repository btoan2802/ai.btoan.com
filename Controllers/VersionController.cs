using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class VersionController : ControllerBase
    {
        private readonly IVersionControlService _versionService;
        private readonly IWebHostEnvironment _env;

        public VersionController(IVersionControlService versionService, IWebHostEnvironment env)
        {
            _versionService = versionService;
            _env = env;
        }

        // GET /api/projects/{id}/versions
        [HttpGet("api/projects/{id}/versions")]
        public async Task<IActionResult> GetProjectVersions(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var versions = await _versionService.GetProjectVersionsAsync(id, userId);
                return Ok(new
                {
                    ok = true,
                    versions = versions.Select(v => new
                    {
                        id = v.Id,
                        versionNumber = v.VersionNumber,
                        version = $"v{v.VersionNumber}",
                        commitMessage = v.CommitMessage,
                        message = v.CommitMessage,
                        parentVersionId = v.ParentVersionId,
                        isAgent = v.CreatedByAgent,
                        createdAt = v.CreatedAt,
                        time = v.CreatedAt.ToString("HH:mm:ss dd/MM/yyyy")
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

        // GET /api/version/{id}/diff
        [HttpGet("api/version/{id}/diff")]
        public async Task<IActionResult> GetVersionDiff(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var diffs = await _versionService.GetVersionDiffsAsync(id, userId);
                return Ok(new
                {
                    ok = true,
                    diffs = diffs.Select(d => new
                    {
                        file = d.FilePath,
                        action = d.Action,
                        oldContent = d.OldContent,
                        newContent = d.NewContent
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

        // POST /api/version/create
        [HttpPost("api/version/create")]
        public async Task<IActionResult> CreateManualCheckpoint([FromBody] CreateCheckpointModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId is required" });

            try
            {
                string msg = string.IsNullOrWhiteSpace(model.Message) ? "User Checkpoint" : model.Message;
                var version = await _versionService.CreateSnapshotAsync(model.ProjectId, userId, msg, isAgent: false);

                return Ok(new
                {
                    ok = true,
                    versionId = version?.Id,
                    versionNumber = version?.VersionNumber,
                    message = version?.CommitMessage,
                    createdAt = version?.CreatedAt
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

        // POST /api/version/{id}/rollback
        [HttpPost("api/version/{id}/rollback")]
        public async Task<IActionResult> RollbackVersion(int id, [FromQuery] int userId = 0)
        {
            try
            {
                string webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var newVersion = await _versionService.RestoreVersionAsync(id, userId, webRoot);

                return Ok(new
                {
                    ok = true,
                    message = $"Project successfully restored to version v{newVersion.VersionNumber}!",
                    restoredVersionId = newVersion.Id,
                    restoredVersionNumber = newVersion.VersionNumber
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
    }

    public class CreateCheckpointModel
    {
        public int ProjectId { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
