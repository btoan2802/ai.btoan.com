using MassTransit;
using Microsoft.AspNetCore.SignalR;
using BtoanAiNet.Hubs;
using BtoanAiNet.Messaging.Contracts;
using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Messaging.Consumers
{
    public class MediaGenerationConsumer : IConsumer<MediaGenerationCommand>
    {
        private readonly IHubContext<WorkspaceHub> _hubContext;
        private readonly IImageGenerationService _imageService;
        private readonly IVideoGenerationService _videoService;
        private readonly IMusicGenerationService _musicService;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<MediaGenerationConsumer> _logger;

        public MediaGenerationConsumer(
            IHubContext<WorkspaceHub> hubContext,
            IImageGenerationService imageService,
            IVideoGenerationService videoService,
            IMusicGenerationService musicService,
            IWebHostEnvironment env,
            ILogger<MediaGenerationConsumer> logger)
        {
            _hubContext = hubContext;
            _imageService = imageService;
            _videoService = videoService;
            _musicService = musicService;
            _env = env;
            _logger = logger;
        }

        public async Task Consume(ConsumeContext<MediaGenerationCommand> context)
        {
            var cmd = context.Message;
            _logger.LogInformation("Processing Media Job: {JobId} ({Type}) for User: {UserId}", cmd.JobId, cmd.Type, cmd.UserId);

            // 1. Send JobStarted event via SignalR
            await NotifyClientAsync(cmd, "Started", 5, null, null);

            try
            {
                string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                string resultUrl = string.Empty;

                // 2. Process based on MediaType
                switch (cmd.Type)
                {
                    case MediaType.Image:
                        await NotifyClientAsync(cmd, "Processing", 30, null, "Generating high-resolution AI Image...");
                        var imgReq = new ImageGenerationRequestModel
                        {
                            Prompt = cmd.Prompt,
                            Conversation_Id = cmd.ConversationId ?? 0
                        };
                        var imgRes = await _imageService.GenerateImageAsync(imgReq);
                        resultUrl = imgRes?["image_url"]?.ToString() ?? string.Empty;
                        break;

                    case MediaType.Video:
                        await NotifyClientAsync(cmd, "Processing", 20, null, "Synthesizing AI Video Frames...");
                        var videoReq = new VideoGenerationRequestModel
                        {
                            Prompt = cmd.Prompt,
                            Conversation_Id = (cmd.ConversationId ?? 0).ToString(),
                            User_Id = cmd.UserId.ToString()
                        };
                        var videoRes = await _videoService.StartVideoJobAsync(videoReq, Directory.GetCurrentDirectory());
                        resultUrl = videoRes?["video_url"]?.ToString() ?? videoRes?["job_id"]?.ToString() ?? string.Empty;
                        break;

                    case MediaType.Music:
                        await NotifyClientAsync(cmd, "Processing", 25, null, "Composing melodies and lyrics...");
                        var musicReq = new MusicGenerationRequestModel
                        {
                            Prompt = cmd.Prompt,
                            User_Id = cmd.UserId,
                            Conversation_Id = cmd.ConversationId ?? 0,
                            Duration = int.TryParse(cmd.Parameters.GetValueOrDefault("duration", "30"), out int d) ? d : 30
                        };
                        var musicRes = await _musicService.GenerateMusicAsync(musicReq, webRootPath);
                        resultUrl = musicRes?["audio_url"]?.ToString() ?? string.Empty;
                        break;

                    default:
                        throw new NotSupportedException($"Media type {cmd.Type} is not supported.");
                }

                // 3. Complete and push result to Client
                await NotifyClientAsync(cmd, "Completed", 100, resultUrl, null);
                _logger.LogInformation("Job {JobId} completed successfully: {ResultUrl}", cmd.JobId, resultUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process Media Job: {JobId}", cmd.JobId);
                await NotifyClientAsync(cmd, "Failed", 100, null, ex.Message);
            }
        }

        private async Task NotifyClientAsync(MediaGenerationCommand cmd, string status, int percent, string? url, string? error)
        {
            var payload = new MediaJobStatusEvent
            {
                JobId = cmd.JobId,
                UserId = cmd.UserId,
                ProjectId = cmd.ProjectId,
                Status = status,
                ProgressPercent = percent,
                ResultUrl = url,
                ErrorMessage = error
            };

            if (cmd.ProjectId.HasValue)
            {
                await _hubContext.Clients.Group($"project-{cmd.ProjectId.Value}").SendAsync("OnMediaJobUpdated", payload);
            }
            await _hubContext.Clients.User(cmd.UserId.ToString()).SendAsync("OnMediaJobUpdated", payload);
        }
    }
}
