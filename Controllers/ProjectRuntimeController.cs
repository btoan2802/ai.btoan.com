using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class ProjectRuntimeController : ControllerBase
    {
        private readonly IProjectRuntimeManagerService _runtimeManager;
        private readonly IWebHostEnvironment _env;

        public ProjectRuntimeController(IProjectRuntimeManagerService runtimeManager, IWebHostEnvironment env)
        {
            _runtimeManager = runtimeManager;
            _env = env;
        }

        // POST /api/runtime/start
        [HttpPost("api/runtime/start")]
        public async Task<IActionResult> StartRuntime([FromBody] RuntimeActionModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId is required" });

            try
            {
                string webRoot = GetWebRoot();
                var result = await _runtimeManager.StartProjectRuntimeAsync(model.ProjectId, userId, webRoot);
                return Ok(new { ok = true, runtime = result });
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

        // POST /api/runtime/stop
        [HttpPost("api/runtime/stop")]
        public async Task<IActionResult> StopRuntime([FromBody] RuntimeActionModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId is required" });

            try
            {
                bool stopped = await _runtimeManager.StopProjectRuntimeAsync(model.ProjectId, userId);
                return Ok(new { ok = true, stopped });
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

        // POST /api/runtime/restart
        [HttpPost("api/runtime/restart")]
        public async Task<IActionResult> RestartRuntime([FromBody] RuntimeActionModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId is required" });

            try
            {
                string webRoot = GetWebRoot();
                var result = await _runtimeManager.RestartProjectRuntimeAsync(model.ProjectId, userId, webRoot);
                return Ok(new { ok = true, runtime = result });
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

        // GET /api/runtime/status
        [HttpGet("api/runtime/status")]
        public async Task<IActionResult> GetRuntimeStatus([FromQuery] int projectId, [FromQuery] int userId = 0)
        {
            if (projectId <= 0)
                return BadRequest(new { ok = false, error = "projectId query parameter is required" });

            try
            {
                var result = await _runtimeManager.GetProjectRuntimeStatusAsync(projectId, userId);
                return Ok(new { ok = true, status = result });
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

        // GET /api/runtime/logs
        [HttpGet("api/runtime/logs")]
        public async Task<IActionResult> GetRuntimeLogs([FromQuery] int projectId, [FromQuery] int userId = 0)
        {
            if (projectId <= 0)
                return BadRequest(new { ok = false, error = "projectId query parameter is required" });

            try
            {
                var logs = await _runtimeManager.GetProjectRuntimeLogsAsync(projectId, userId);
                return Ok(new { ok = true, logs });
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

        // GET /api/runtime/preview
        [HttpGet("api/runtime/preview")]
        [HttpGet("api/runtime/url")]
        public async Task<IActionResult> GetRuntimePreviewUrl([FromQuery] int projectId, [FromQuery] int userId = 0)
        {
            if (projectId <= 0)
                return BadRequest(new { ok = false, error = "projectId query parameter is required" });

            try
            {
                string url = await _runtimeManager.GetLivePreviewUrlAsync(projectId, userId);
                return Ok(new { ok = true, url, previewUrl = url });
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

    public class RuntimeActionModel
    {
        public int ProjectId { get; set; }
    }
}
