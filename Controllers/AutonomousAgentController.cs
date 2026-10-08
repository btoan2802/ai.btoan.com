using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class AutonomousAgentController : ControllerBase
    {
        private readonly IAgentOrchestrator _orchestrator;
        private readonly IWebHostEnvironment _env;

        public AutonomousAgentController(IAgentOrchestrator orchestrator, IWebHostEnvironment env)
        {
            _orchestrator = orchestrator;
            _env = env;
        }

        // POST /api/agent/run
        [HttpPost("api/agent/run")]
        public async Task<IActionResult> RunAutonomousAgent([FromBody] AutonomousRunRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Prompt) || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId and Prompt are required" });

            try
            {
                string mode = string.Equals(model.Mode, "SAFE", StringComparison.OrdinalIgnoreCase) ? "SAFE" : "AUTO";
                string webRoot = GetWebRoot();

                var result = await _orchestrator.RunAutonomousWorkflowAsync(model.ProjectId, model.Prompt, userId, mode, webRoot);
                return Ok(new { ok = true, result });
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

        // POST /api/agent/approve
        [HttpPost("api/agent/approve")]
        public async Task<IActionResult> ApproveAutonomousTask([FromBody] ApproveAgentTaskModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.AgentTaskId <= 0)
                return BadRequest(new { ok = false, error = "AgentTaskId is required" });

            try
            {
                string webRoot = GetWebRoot();
                bool buildOk = await _orchestrator.ApproveAutonomousTaskAsync(model.AgentTaskId, userId, webRoot);
                return Ok(new { ok = true, buildSucceeded = buildOk });
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

        // GET /api/agent/tasks/{projectId}
        [HttpGet("api/agent/tasks/{projectId}")]
        public async Task<IActionResult> GetProjectAutonomousTasks(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var tasks = await _orchestrator.GetProjectAutonomousTasksAsync(projectId, userId);
                return Ok(new
                {
                    ok = true,
                    tasks = tasks.Select(t => new
                    {
                        t.Id,
                        t.ParentTaskId,
                        t.Title,
                        t.Description,
                        t.Status,
                        t.Order,
                        t.CreatedAt,
                        t.CompletedAt
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

        // GET /api/agent/logs
        [HttpGet("api/agent/logs")]
        public async Task<IActionResult> GetAgentExecutionLogs([FromQuery] int projectId, [FromQuery] int userId = 0)
        {
            if (projectId <= 0)
                return BadRequest(new { ok = false, error = "projectId query parameter is required" });

            try
            {
                var logs = await _orchestrator.GetExecutionLogsAsync(projectId, userId);
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

        private string GetWebRoot()
        {
            return _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }
    }

    public class AutonomousRunRequestModel
    {
        public int ProjectId { get; set; }
        public string Prompt { get; set; } = string.Empty;
        public string Mode { get; set; } = "AUTO"; // AUTO or SAFE
    }

    public class ApproveAgentTaskModel
    {
        public int AgentTaskId { get; set; }
    }
}
