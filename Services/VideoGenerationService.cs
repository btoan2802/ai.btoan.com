using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BtoanAiNet.Repositories;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IVideoGenerationService
    {
        Task<JsonObject> StartVideoJobAsync(VideoGenerationRequestModel model, string contentRootPath);
        Task<JsonObject> CheckVideoJobStatusAsync(string jobId, int conversationId, int userId, int chatId, string webRootPath);
    }

    public class VideoGenerationService : IVideoGenerationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConversationRepository _conversationRepository;

        private const string ProjectId = "airy-web-431004-v1";
        private const string Location = "us-central1";
        private const string ModelId = "veo-3.1-generate-001";
        private const string BucketName = "airy-web-431004-v1-veo";

        public VideoGenerationService(HttpClient httpClient, IConversationRepository conversationRepository)
        {
            _httpClient = httpClient;
            _conversationRepository = conversationRepository;
        }

        private async Task<string?> GetAccessTokenAsync(string keyFilePath)
        {
            if (!File.Exists(keyFilePath)) return null;

            try
            {
                string keyJson = await File.ReadAllTextAsync(keyFilePath);
                using var doc = JsonDocument.Parse(keyJson);
                var root = doc.RootElement;

                string clientEmail = root.GetProperty("client_email").GetString() ?? "";
                string privateKeyPem = root.GetProperty("private_key").GetString() ?? "";

                long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var headerObj = new { alg = "RS256", typ = "JWT" };
                var payloadObj = new
                {
                    iss = clientEmail,
                    scope = "https://www.googleapis.com/auth/cloud-platform",
                    aud = "https://oauth2.googleapis.com/token",
                    exp = now + 3600,
                    iat = now
                };

                string headerEncoded = Base64UrlEncode(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(headerObj)));
                string payloadEncoded = Base64UrlEncode(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payloadObj)));
                string unsignedJwt = $"{headerEncoded}.{payloadEncoded}";

                byte[] signatureBytes;
                using (var rsa = RSA.Create())
                {
                    rsa.ImportFromPem(privateKeyPem);
                    signatureBytes = rsa.SignData(Encoding.UTF8.GetBytes(unsignedJwt), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
                }

                string signedJwt = $"{unsignedJwt}.{Base64UrlEncode(signatureBytes)}";

                var tokenRequest = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                    new KeyValuePair<string, string>("assertion", signedJwt)
                });

                var response = await _httpClient.PostAsync("https://oauth2.googleapis.com/token", tokenRequest);
                if (!response.IsSuccessStatusCode) return null;

                string respString = await response.Content.ReadAsStringAsync();
                using var respDoc = JsonDocument.Parse(respString);
                return respDoc.RootElement.GetProperty("access_token").GetString();
            }
            catch
            {
                return null;
            }
        }

        private string Base64UrlEncode(byte[] input)
        {
            return Convert.ToBase64String(input)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }

        public async Task<JsonObject> StartVideoJobAsync(VideoGenerationRequestModel model, string contentRootPath)
        {
            string prompt = model.Prompt?.Trim() ?? "";
            if (string.IsNullOrEmpty(prompt))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Prompt is required" };
            }

            string keyFilePath = Path.Combine(contentRootPath, "ai", "api", "google-key.json");
            string? accessToken = await GetAccessTokenAsync(keyFilePath);
            if (string.IsNullOrEmpty(accessToken))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Auth failed (token generation)." };
            }

            long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            string outputUri = $"gs://{BucketName}/veo-output/{model.User_Id}/{model.Conversation_Id}/{timestamp}/";

            var instance = new JsonObject { ["prompt"] = prompt };

            if (!string.IsNullOrEmpty(model.Image))
            {
                string base64Image = model.Image;
                string mimeType = "image/png";

                if (base64Image.StartsWith("data:"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(base64Image, @"^data:([^;]+);base64,");
                    if (match.Success) mimeType = match.Groups[1].Value;
                    int commaIdx = base64Image.IndexOf(',');
                    if (commaIdx >= 0) base64Image = base64Image.Substring(commaIdx + 1);
                }

                instance["image"] = new JsonObject
                {
                    ["bytesBase64Encoded"] = base64Image,
                    ["mimeType"] = mimeType
                };
            }

            var payload = new JsonObject
            {
                ["instances"] = new JsonArray { instance },
                ["parameters"] = new JsonObject
                {
                    ["sampleCount"] = 1,
                    ["fps"] = 24,
                    ["aspectRatio"] = "16:9",
                    ["videoDurationSeconds"] = model.Duration,
                    ["storageUri"] = outputUri,
                    ["personGeneration"] = "allow_all"
                }
            };

            string url = $"https://{Location}-aiplatform.googleapis.com/v1/projects/{ProjectId}/locations/{Location}/publishers/google/models/{ModelId}:predictLongRunning";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (root.TryGetProperty("name", out var jobName))
            {
                return new JsonObject
                {
                    ["success"] = true,
                    ["job_id"] = jobName.GetString(),
                    ["msg"] = "Veo job started successfully",
                    ["provider"] = "google-veo"
                };
            }

            string errorMsg = root.TryGetProperty("error", out var err) ? err.GetProperty("message").GetString() ?? "Failed to start Veo." : "Failed to start Veo.";
            return new JsonObject { ["success"] = false, ["error"] = errorMsg };
        }

        public async Task<JsonObject> CheckVideoJobStatusAsync(string jobId, int conversationId, int userId, int chatId, string webRootPath)
        {
            if (string.IsNullOrEmpty(jobId))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Job ID required" };
            }

            string contentRootPath = Directory.GetCurrentDirectory();
            string keyFilePath = Path.Combine(contentRootPath, "ai", "api", "google-key.json");
            string? accessToken = await GetAccessTokenAsync(keyFilePath);

            if (string.IsNullOrEmpty(accessToken))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Auth failed" };
            }

            string url = $"https://{Location}-aiplatform.googleapis.com/v1/projects/{ProjectId}/locations/{Location}/publishers/google/models/{ModelId}:fetchPredictOperation";

            var payload = new JsonObject { ["operationName"] = jobId };
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            string responseBody = await response.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (root.TryGetProperty("error", out var sysError))
            {
                return new JsonObject
                {
                    ["success"] = false,
                    ["status"] = "failed",
                    ["error"] = sysError.GetProperty("message").GetString() ?? "Google System Error"
                };
            }

            bool isDone = root.TryGetProperty("done", out var doneProp) && doneProp.GetBoolean();

            if (isDone)
            {
                if (root.TryGetProperty("response", out var respObj) && respObj.TryGetProperty("videos", out var videosArr) && videosArr.GetArrayLength() > 0)
                {
                    var videoElem = videosArr[0];
                    string gcsUri = videoElem.TryGetProperty("uri", out var u) ? u.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(gcsUri) && videoElem.TryGetProperty("gcsUri", out var gu))
                    {
                        gcsUri = gu.GetString() ?? "";
                    }

                    if (!string.IsNullOrEmpty(gcsUri))
                    {
                        string downloadUrl = gcsUri.Replace("gs://", "https://storage.googleapis.com/");
                        byte[] videoBytes = await _httpClient.GetByteArrayAsync(downloadUrl);

                        string videoDir = Path.Combine(webRootPath, "uploads", "videos");
                        if (!Directory.Exists(videoDir)) Directory.CreateDirectory(videoDir);

                        string filename = $"video_{Guid.NewGuid().ToString("N").Substring(0, 10)}.mp4";
                        string savePath = Path.Combine(videoDir, filename);
                        string publicUrl = $"/uploads/videos/{filename}";

                        await File.WriteAllBytesAsync(savePath, videoBytes);

                        return new JsonObject
                        {
                            ["success"] = true,
                            ["status"] = "completed",
                            ["video_url"] = publicUrl,
                            ["msg"] = "Video generated and saved successfully.",
                            ["provider"] = "google-veo"
                        };
                    }
                }

                return new JsonObject
                {
                    ["success"] = false,
                    ["status"] = "failed",
                    ["error"] = "Google không trả về link video."
                };
            }

            string progress = "0";
            if (root.TryGetProperty("metadata", out var meta) && meta.TryGetProperty("progressPercentage", out var p))
            {
                progress = p.ToString();
            }

            return new JsonObject
            {
                ["success"] = true,
                ["status"] = "processing",
                ["progress"] = progress,
                ["msg"] = $"Veo is rendering... ({progress}%)"
            };
        }
    }
}
