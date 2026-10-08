using BtoanAiNet.Data;
using BtoanAiNet.Models;
using BtoanAiNet.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    public class DiffReviewController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDiffService _diffService;
        private readonly IWorkspaceService _workspaceService;
        private readonly IWebHostEnvironment _env;

        public DiffReviewController(
            AppDbContext context,
            IDiffService diffService,
            IWorkspaceService workspaceService,
            IWebHostEnvironment env)
        {
            _context = context;
            _diffService = diffService;
            _workspaceService = workspaceService;
            _env = env;
        }

        // GET /api/agent/change/{id}
        [HttpGet("api/agent/change/{id}")]
        public async Task<IActionResult> GetCodeChangeDetails(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var change = await _context.CodeChanges.FindAsync(id);
                if (change == null)
                {
                    // Fallback to AgentChange
                    var agentChange = await _context.AgentChanges.FindAsync(id);
                    if (agentChange == null) return NotFound(new { ok = false, error = "CodeChange record not found" });

                    var agentTask = await _context.AgentTasks.FindAsync(agentChange.AgentTaskId);
                    int projId = agentTask?.ProjectId ?? 1;

                    if (!await _workspaceService.ValidateProjectOwnershipAsync(projId, userId))
                        return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                    string diffText = _diffService.GenerateUnifiedDiff(agentChange.OldContent, agentChange.NewContent, agentChange.FilePath);
                    var secReview = _diffService.PerformSecurityInspection(agentChange.NewContent);

                    return Ok(new
                    {
                        ok = true,
                        id = agentChange.Id,
                        file = agentChange.FilePath,
                        oldCode = agentChange.OldContent,
                        newCode = agentChange.NewContent,
                        diff = diffText,
                        status = "Pending",
                        securityReview = secReview
                    });
                }

                if (!await _workspaceService.ValidateProjectOwnershipAsync(change.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                var review = _diffService.PerformSecurityInspection(change.NewContent);

                return Ok(new
                {
                    ok = true,
                    id = change.Id,
                    file = change.FilePath,
                    oldCode = change.OldContent,
                    newCode = change.NewContent,
                    diff = change.DiffText,
                    status = change.Status,
                    aiComment = change.AiComment,
                    securityReview = review
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/agent/change/{id}/accept
        [HttpPost("api/agent/change/{id}/accept")]
        public async Task<IActionResult> AcceptCodeChange(int id, [FromQuery] int userId = 0)
        {
            try
            {
                string webRoot = GetWebRoot();
                var change = await _context.CodeChanges.FindAsync(id);
                if (change == null)
                {
                    var agentChange = await _context.AgentChanges.FindAsync(id);
                    if (agentChange == null) return NotFound(new { ok = false, error = "CodeChange record not found" });

                    var task = await _context.AgentTasks.FindAsync(agentChange.AgentTaskId);
                    int projId = task?.ProjectId ?? 1;

                    if (!await _workspaceService.ValidateProjectOwnershipAsync(projId, userId))
                        return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                    // Security Inspection Filter Check
                    var secReview = _diffService.PerformSecurityInspection(agentChange.NewContent);
                    if (secReview.IsBlocked)
                    {
                        return BadRequest(new
                        {
                            ok = false,
                            error = "Security Violation: Blocked apply due to critical vulnerabilities.",
                            findings = secReview.Findings
                        });
                    }

                    await _workspaceService.SaveFileWithVersionAsync(
                        projId,
                        agentChange.FilePath,
                        agentChange.NewContent,
                        "USER",
                        "Accepted AI CodeChange proposal",
                        webRoot
                    );

                    return Ok(new { ok = true, message = "Change accepted and applied to workspace!", status = "Applied" });
                }

                if (!await _workspaceService.ValidateProjectOwnershipAsync(change.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                var secCheck = _diffService.PerformSecurityInspection(change.NewContent);
                if (secCheck.IsBlocked)
                {
                    return BadRequest(new
                    {
                        ok = false,
                        error = "Security Violation: Blocked apply due to critical vulnerabilities.",
                        findings = secCheck.Findings
                    });
                }

                await _workspaceService.SaveFileWithVersionAsync(
                    change.ProjectId,
                    change.FilePath,
                    change.NewContent,
                    "USER",
                    "Accepted AI CodeChange proposal",
                    webRoot
                );

                change.Status = "Applied";
                await _context.SaveChangesAsync();

                return Ok(new { ok = true, message = "Change accepted and applied to workspace!", status = "Applied" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/agent/change/{id}/reject
        [HttpPost("api/agent/change/{id}/reject")]
        public async Task<IActionResult> RejectCodeChange(int id, [FromQuery] int userId = 0)
        {
            try
            {
                var change = await _context.CodeChanges.FindAsync(id);
                if (change != null)
                {
                    if (!await _workspaceService.ValidateProjectOwnershipAsync(change.ProjectId, userId))
                        return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                    change.Status = "Rejected";
                    await _context.SaveChangesAsync();
                }

                return Ok(new { ok = true, message = "Change rejected and discarded.", status = "Rejected" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { ok = false, error = ex.Message });
            }
        }

        // POST /api/agent/change/{id}/partial-accept
        [HttpPost("api/agent/change/{id}/partial-accept")]
        public async Task<IActionResult> PartialAcceptCodeChange(int id, [FromBody] PartialAcceptModel model, [FromQuery] int userId = 0)
        {
            if (model == null || model.AcceptedHunkIndices == null)
                return BadRequest(new { ok = false, error = "AcceptedHunkIndices array is required" });

            try
            {
                string webRoot = GetWebRoot();
                var change = await _context.CodeChanges.FindAsync(id);
                if (change == null)
                {
                    var agentChange = await _context.AgentChanges.FindAsync(id);
                    if (agentChange == null) return NotFound(new { ok = false, error = "CodeChange record not found" });

                    var task = await _context.AgentTasks.FindAsync(agentChange.AgentTaskId);
                    int projId = task?.ProjectId ?? 1;

                    if (!await _workspaceService.ValidateProjectOwnershipAsync(projId, userId))
                        return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                    string diffText = _diffService.GenerateUnifiedDiff(agentChange.OldContent, agentChange.NewContent, agentChange.FilePath);
                    string partialContent = _diffService.ApplyPartialHunks(agentChange.OldContent, diffText, model.AcceptedHunkIndices);

                    await _workspaceService.SaveFileWithVersionAsync(
                        projId,
                        agentChange.FilePath,
                        partialContent,
                        "USER",
                        "Applied Partial Hunk Accept proposal",
                        webRoot
                    );

                    return Ok(new { ok = true, message = "Partial hunks applied successfully!", status = "Applied" });
                }

                if (!await _workspaceService.ValidateProjectOwnershipAsync(change.ProjectId, userId))
                    return StatusCode(403, new { ok = false, error = "Access Denied: You do not own this project." });

                string mergedContent = _diffService.ApplyPartialHunks(change.OldContent, change.DiffText, model.AcceptedHunkIndices);

                await _workspaceService.SaveFileWithVersionAsync(
                    change.ProjectId,
                    change.FilePath,
                    mergedContent,
                    "USER",
                    "Applied Partial Hunk Accept proposal",
                    webRoot
                );

                change.Status = "Applied";
                await _context.SaveChangesAsync();

                return Ok(new { ok = true, message = "Partial hunks applied successfully!", status = "Applied" });
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

    public class PartialAcceptModel
    {
        public List<int> AcceptedHunkIndices { get; set; } = new();
    }
}
