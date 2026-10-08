using System.Text.Json.Nodes;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IStorageService
    {
        Task<JsonObject> ExportFileAsync(FileUploadRequestModel model, string webRootPath);
        Task<(Stream? Stream, string ContentType, string DownloadFilename)> GetDownloadProxyStreamAsync(string url, string filename);
    }

    public class StorageService : IStorageService
    {
        private readonly HttpClient _httpClient;

        public StorageService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<JsonObject> ExportFileAsync(FileUploadRequestModel model, string webRootPath)
        {
            string content = model.Content?.Trim() ?? "";
            if (string.IsNullOrEmpty(content))
            {
                return new JsonObject { ["error"] = "no content" };
            }

            string ext = model.Ext?.ToLower()?.Trim() ?? "txt";
            string filename = $"file_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

            string filesDir = Path.Combine(webRootPath, "files");
            if (!Directory.Exists(filesDir)) Directory.CreateDirectory(filesDir);

            string targetFilePath = Path.Combine(filesDir, $"{filename}.{ext}");
            string publicUrl = $"/files/{filename}.{ext}";

            if (ext == "txt")
            {
                // UTF-8 with BOM
                byte[] bom = new byte[] { 0xEF, 0xBB, 0xBF };
                byte[] contentBytes = System.Text.Encoding.UTF8.GetBytes(content);
                byte[] finalBytes = bom.Concat(contentBytes).ToArray();

                await File.WriteAllBytesAsync(targetFilePath, finalBytes);
                return new JsonObject { ["url"] = publicUrl };
            }

            if (ext == "html")
            {
                string htmlContent = $@"<html>
<meta charset='UTF-8'>
<body style='font-family: Arial; padding:20px; line-height:1.6'>
{content.Replace("\n", "<br/>")}
</body>
</html>";
                await File.WriteAllTextAsync(targetFilePath, htmlContent, System.Text.Encoding.UTF8);
                return new JsonObject { ["url"] = publicUrl };
            }

            // Fallback for docx / pdf / other format
            await File.WriteAllTextAsync(targetFilePath, content, System.Text.Encoding.UTF8);
            return new JsonObject { ["url"] = publicUrl };
        }

        public async Task<(Stream? Stream, string ContentType, string DownloadFilename)> GetDownloadProxyStreamAsync(string url, string filename)
        {
            if (string.IsNullOrEmpty(url) || !Uri.TryCreate(url, UriKind.Absolute, out _))
            {
                return (null, "text/plain", filename);
            }

            try
            {
                var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode) return (null, "text/plain", filename);

                var stream = await response.Content.ReadAsStreamAsync();
                string contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
                string downloadName = !string.IsNullOrEmpty(filename) ? filename : Path.GetFileName(url);

                return (stream, contentType, downloadName);
            }
            catch
            {
                return (null, "text/plain", filename);
            }
        }
    }
}
