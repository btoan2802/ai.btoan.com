using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    public class MediaController : Controller
    {
        private readonly IImageGenerationService _imageGenerationService;
        private readonly IVideoGenerationService _videoGenerationService;
        private readonly IMusicGenerationService _musicGenerationService;
        private readonly IWebHostEnvironment _env;

        public MediaController(
            IImageGenerationService imageGenerationService,
            IVideoGenerationService videoGenerationService,
            IMusicGenerationService musicGenerationService,
            IWebHostEnvironment env)
        {
            _imageGenerationService = imageGenerationService;
            _videoGenerationService = videoGenerationService;
            _musicGenerationService = musicGenerationService;
            _env = env;
        }

        // POST /ai/api/generate_image.php
        [HttpPost]
        [Route("ai/api/generate_image.php")]
        [Route("Media/GenerateImage")]
        public async Task<IActionResult> GenerateImage([FromBody] ImageGenerationRequestModel model)
        {
            if (model == null) return Json(new { success = false, error = "Invalid body" });
            Console.WriteLine("[IMAGE CONTROLLER RECEIVED] " + model.Prompt);
            Console.WriteLine("[IMAGE CONTROLLER CONVERSATION_ID] " + model.Conversation_Id);

            var result = await _imageGenerationService.GenerateImageAsync(model);
            return Content(result.ToJsonString(), "application/json");
        }

        // POST /ai/api/edit_image.php
        [HttpPost]
        [Route("ai/api/edit_image.php")]
        [Route("Media/EditImage")]
        public async Task<IActionResult> EditImage([FromBody] EditImageRequestModel model)
        {
            if (model == null) return Json(new { success = false, error = "Invalid body" });

            string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var result = await _imageGenerationService.EditImageAsync(model, webRootPath);
            return Content(result.ToJsonString(), "application/json");
        }

        // GET /ai/api/get_last_image.php
        [HttpGet]
        [Route("ai/api/get_last_image.php")]
        [Route("Media/GetLastImage")]
        public async Task<IActionResult> GetLastImage([FromQuery] int conversation_id)
        {
            var result = await _imageGenerationService.GetLastImageAsync(conversation_id);
            return Content(result.ToJsonString(), "application/json");
        }

        // POST /ai/api/generate_video.php
        [HttpPost]
        [Route("ai/api/generate_video.php")]
        [Route("Media/GenerateVideo")]
        public async Task<IActionResult> GenerateVideo([FromBody] VideoGenerationRequestModel model)
        {
            if (model == null) return Json(new { success = false, error = "Invalid body" });

            string contentRootPath = Directory.GetCurrentDirectory();
            var result = await _videoGenerationService.StartVideoJobAsync(model, contentRootPath);
            return Content(result.ToJsonString(), "application/json");
        }

        // GET /ai/api/check_video_job.php
        [HttpGet]
        [Route("ai/api/check_video_job.php")]
        [Route("Media/CheckVideoJob")]
        public async Task<IActionResult> CheckVideoJob(
            [FromQuery] string job_id,
            [FromQuery] int conversation_id,
            [FromQuery] int user_id,
            [FromQuery] int chat_id)
        {
            string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var result = await _videoGenerationService.CheckVideoJobStatusAsync(job_id, conversation_id, user_id, chat_id, webRootPath);
            return Content(result.ToJsonString(), "application/json");
        }

        // POST /ai/api/generate_music.php
        [HttpPost]
        [Route("ai/api/generate_music.php")]
        [Route("Media/GenerateMusic")]
        public async Task<IActionResult> GenerateMusic([FromBody] MusicGenerationRequestModel model)
        {
            if (model == null) return Json(new { success = false, error = "Invalid body" });

            string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var result = await _musicGenerationService.GenerateMusicAsync(model, webRootPath);
            return Content(result.ToJsonString(), "application/json");
        }
    }
}
