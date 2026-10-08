using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    public class FileController : Controller
    {
        private readonly IStorageService _storageService;
        private readonly IWebHostEnvironment _env;

        public FileController(IStorageService storageService, IWebHostEnvironment env)
        {
            _storageService = storageService;
            _env = env;
        }

        // POST /ai/api/upload.php
        [HttpPost]
        [Route("ai/api/upload.php")]
        [Route("File/Upload")]
        public async Task<IActionResult> Upload([FromBody] FileUploadRequestModel model)
        {
            if (model == null) return Json(new { error = "no content" });

            string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var result = await _storageService.ExportFileAsync(model, webRootPath);
            return Content(result.ToJsonString(), "application/json");
        }

        // GET /ai/api/download_proxy.php
        [HttpGet]
        [Route("ai/api/download_proxy.php")]
        [Route("File/DownloadProxy")]
        public async Task<IActionResult> DownloadProxy([FromQuery] string url, [FromQuery] string filename = "downloaded_file")
        {
            if (string.IsNullOrEmpty(url)) return BadRequest("Missing URL");

            var (stream, contentType, downloadFilename) = await _storageService.GetDownloadProxyStreamAsync(url, filename);
            if (stream == null) return NotFound("Could not open source file.");

            return File(stream, contentType, downloadFilename);
        }
    }
}
