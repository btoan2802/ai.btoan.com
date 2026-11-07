using MassTransit;
using Microsoft.AspNetCore.Mvc;
using BtoanAiNet.Messaging.Contracts;

namespace BtoanAiNet.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MediaAsyncController : ControllerBase
    {
        private readonly IPublishEndpoint _publishEndpoint;

        public MediaAsyncController(IPublishEndpoint publishEndpoint)
        {
            _publishEndpoint = publishEndpoint;
        }

        public record QueueMediaRequest(
            string Prompt, 
            MediaType Type, 
            int UserId, 
            int? ProjectId, 
            int? ConversationId,
            Dictionary<string, string>? Parameters);

        [HttpPost("queue")]
        public async Task<IActionResult> QueueMediaJob([FromBody] QueueMediaRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Prompt))
                return BadRequest(new { error = "Prompt is required." });

            var command = new MediaGenerationCommand
            {
                JobId = Guid.NewGuid(),
                UserId = request.UserId,
                ProjectId = request.ProjectId,
                ConversationId = request.ConversationId,
                Type = request.Type,
                Prompt = request.Prompt,
                Parameters = request.Parameters ?? new()
            };

            await _publishEndpoint.Publish(command);

            return Accepted(new
            {
                success = true,
                jobId = command.JobId,
                status = "Queued",
                message = "Media generation task enqueued successfully. Listen on SignalR 'OnMediaJobUpdated'."
            });
        }
    }
}

