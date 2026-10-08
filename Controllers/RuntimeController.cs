using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    [Route("api/runtime")]
    public class RuntimeController : ControllerBase
    {
        private readonly IRuntimeService _runtimeService;
        private readonly IWebHostEnvironment _env;

        public RuntimeController(IRuntimeService runtimeService, IWebHostEnvironment env)
        {
            _runtimeService = runtimeService;
            _env = env;
        }

        // POST /api/runtime/run
        [HttpPost("run")]
        public async Task<IActionResult> RunCommand([FromBody] RunRuntimeCommandModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0 || string.IsNullOrWhiteSpace(model.Command))
                return BadRequest(new { ok = false, error = "ProjectId and Command are required" });

            try
            {
                string webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var session = await _runtimeService.CreateEnvironmentAndExecuteAsync(model.ProjectId, model.Command, userId, webRoot);

                return Ok(new
                {
                    ok = true,
                    sessionId = session.Id,
                    command = session.Command,
                    status = session.Status,
                    startedAt = session.StartedAt
                });
            }
            catch (UnauthorizedAccessException uex)
            {
                return StatusCode(403, new { ok = false, error = uex.Message });
            }
            catch (InvalidOperationException iex)
            {
                return BadRequest(new { ok = false, error = iex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // GET /api/runtime/output/{sessionId}
        [HttpGet("output/{sessionId}")]
        public async Task<IActionResult> GetSessionOutput(int sessionId, [FromQuery] int userId = 0)
        {
            try
            {
                var session = await _runtimeService.GetSessionOutputAsync(sessionId, userId);
                if (session == null) return NotFound(new { ok = false, error = "Session not found" });

                return Ok(new
                {
                    ok = true,
                    sessionId = session.Id,
                    command = session.Command,
                    status = session.Status,
                    stdout = session.StdOut,
                    stderr = session.StdErr,
                    exitCode = session.ExitCode,
                    startedAt = session.StartedAt,
                    finishedAt = session.FinishedAt
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

        // POST /api/runtime/stop/{sessionId}
        [HttpPost("stop/{sessionId}")]
        public async Task<IActionResult> StopSession(int sessionId, [FromQuery] int userId = 0)
        {
            try
            {
                bool stopped = await _runtimeService.StopExecutionAsync(sessionId, userId);
                if (!stopped) return BadRequest(new { ok = false, error = "Session is not running or not found" });

                return Ok(new { ok = true, message = "Session stopped successfully" });
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

    public class RunRuntimeCommandModel
    {
        public int ProjectId { get; set; }
        public string Command { get; set; } = string.Empty;
    }
}
