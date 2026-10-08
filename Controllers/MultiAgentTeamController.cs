using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class MultiAgentTeamController : ControllerBase
    {
        private readonly IAgentTeamManager _teamManager;
        private readonly IWebHostEnvironment _env;

        public MultiAgentTeamController(IAgentTeamManager teamManager, IWebHostEnvironment env)
        {
            _teamManager = teamManager;
            _env = env;
        }

        // POST /api/team/run
        [HttpPost("api/team/run")]
        public async Task<IActionResult> RunTeamWorkflow([FromBody] TeamRunRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Prompt) || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId and Prompt are required" });

            try
            {
                string webRoot = GetWebRoot();
                var result = await _teamManager.RunTeamWorkflowAsync(model.ProjectId, model.Prompt, userId, webRoot);
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

        // GET /api/team/status/{projectId}
        [HttpGet("api/team/status/{projectId}")]
        public async Task<IActionResult> GetTeamStatus(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var teamStatus = await _teamManager.GetTeamStatusAsync(projectId, userId);
                return Ok(new { ok = true, agents = teamStatus });
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

        // GET /api/team/messages/{projectId}
        [HttpGet("api/team/messages/{projectId}")]
        public async Task<IActionResult> GetTeamMessages(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var messages = await _teamManager.GetTeamMessagesAsync(projectId, userId);
                return Ok(new { ok = true, messages });
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

        // GET /api/team/knowledge/{projectId}
        [HttpGet("api/team/knowledge/{projectId}")]
        public async Task<IActionResult> GetTeamKnowledgeBase(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var knowledge = await _teamManager.GetTeamKnowledgeBaseAsync(projectId, userId);
                return Ok(new { ok = true, knowledge });
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

    public class TeamRunRequestModel
    {
        public int ProjectId { get; set; }
        public string Prompt { get; set; } = string.Empty;
    }
}
