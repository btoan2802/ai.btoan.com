using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class CloudDeploymentController : ControllerBase
    {
        private readonly IDeploymentService _deploymentService;
        private readonly IWebHostEnvironment _env;

        public CloudDeploymentController(IDeploymentService deploymentService, IWebHostEnvironment env)
        {
            _deploymentService = deploymentService;
            _env = env;
        }

        // POST /api/deployment/deploy
        [HttpPost("api/deployment/deploy")]
        public async Task<IActionResult> DeployProject([FromBody] DeployRequestModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0)
                return BadRequest(new { ok = false, error = "ProjectId is required" });

            try
            {
                string webRoot = GetWebRoot();
                var result = await _deploymentService.DeployProjectAsync(model.ProjectId, model.Environment, userId, webRoot);
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

        // POST /api/deployment/stop/{id}
        [HttpPost("api/deployment/stop/{id}")]
        public async Task<IActionResult> StopDeployment(int id, [FromQuery] int userId = 0)
        {
            try
            {
                bool stopped = await _deploymentService.StopDeploymentAsync(id, userId);
                return Ok(new { ok = stopped, message = stopped ? "Deployment container stopped successfully" : "Deployment not found" });
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

        // POST /api/deployment/restart/{id}
        [HttpPost("api/deployment/restart/{id}")]
        public async Task<IActionResult> RestartDeployment(int id, [FromQuery] int userId = 0)
        {
            try
            {
                bool restarted = await _deploymentService.RestartDeploymentAsync(id, userId);
                return Ok(new { ok = restarted, message = restarted ? "Deployment container restarted successfully" : "Deployment not found" });
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

        // POST /api/deployment/rollback/{id}
        [HttpPost("api/deployment/rollback/{id}")]
        public async Task<IActionResult> RollbackDeployment(int id, [FromQuery] int userId = 0)
        {
            try
            {
                string webRoot = GetWebRoot();
                bool rolledBack = await _deploymentService.RollbackDeploymentAsync(id, userId, webRoot);
                return Ok(new { ok = rolledBack, message = rolledBack ? "Rollback executed successfully" : "Deployment not found" });
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

        // GET /api/deployment/status/{projectId}
        [HttpGet("api/deployment/status/{projectId}")]
        public async Task<IActionResult> GetProjectDeployments(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var deployments = await _deploymentService.GetProjectDeploymentsAsync(projectId, userId);
                return Ok(new { ok = true, deployments });
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

        // GET /api/deployment/logs/{id}
        [HttpGet("api/deployment/logs/{id}")]
        public async Task<IActionResult> GetDeploymentLogs(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var logs = await _deploymentService.GetDeploymentLogsAsync(id, userId);
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

        // POST /api/deployment/env
        [HttpPost("api/deployment/env")]
        public async Task<IActionResult> SaveEnvironmentVariable([FromBody] SaveEnvVarModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.ProjectId <= 0 || string.IsNullOrWhiteSpace(model.Key))
                return BadRequest(new { ok = false, error = "ProjectId and Key are required" });

            try
            {
                bool saved = await _deploymentService.SaveEnvironmentVariableAsync(model.ProjectId, model.Environment, model.Key, model.Value, userId);
                return Ok(new { ok = saved, message = "Environment variable encrypted and saved successfully!" });
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

        // GET /api/deployment/env/{projectId}
        [HttpGet("api/deployment/env/{projectId}")]
        public async Task<IActionResult> GetEnvironmentVariables(int projectId, [FromQuery] int userId = 0)
        {
            try
            {
                var vars = await _deploymentService.GetEnvironmentVariablesAsync(projectId, userId);
                return Ok(new { ok = true, environmentVariables = vars });
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

    public class DeployRequestModel
    {
        public int ProjectId { get; set; }
        public string Environment { get; set; } = "Production";
    }

    public class SaveEnvVarModel
    {
        public int ProjectId { get; set; }
        public string Environment { get; set; } = "Production";
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }
}
