using System.Text.Json;
using System.Text.Json.Nodes;
using BtoanAiNet.Repositories;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IMusicGenerationService
    {
        Task<JsonObject> GenerateMusicAsync(MusicGenerationRequestModel model, string webRootPath);
    }

    public class MusicGenerationService : IMusicGenerationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConversationRepository _conversationRepository;

        private static readonly string[] ApiKeys = new[]
        {
            "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw",
            "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
            "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
            "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
            "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
            "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
            "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
            "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
        };

        public MusicGenerationService(HttpClient httpClient, IConversationRepository conversationRepository)
        {
            _httpClient = httpClient;
            _conversationRepository = conversationRepository;
        }

        public async Task<JsonObject> GenerateMusicAsync(MusicGenerationRequestModel model, string webRootPath)
        {
            if (model.User_Id <= 0)
            {
                return new JsonObject { ["success"] = false, ["error"] = "User not logged in" };
            }

            string prompt = model.Prompt?.Trim() ?? "";
            if (string.IsNullOrEmpty(prompt))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Prompt is required" };
            }

            // Resolve lyrics placeholder
            if (prompt.Contains("[FULL_USER_LYRICS]"))
            {
                var chats = await _conversationRepository.GetMessagesByConversationIdAsync(model.Conversation_Id);
                var lastUserChat = chats.OrderByDescending(c => c.Id).FirstOrDefault(c => !string.IsNullOrEmpty(c.Question));
                if (lastUserChat != null)
                {
                    string userLyrics = lastUserChat.Question ?? "";
                    userLyrics = System.Text.RegularExpressions.Regex.Replace(userLyrics, @"\[GENMUSIC\].*$", "", System.Text.RegularExpressions.RegexOptions.Singleline);
                    prompt = prompt.Replace("[FULL_USER_LYRICS]", $"\"{userLyrics.Trim()}\"");
                }
            }

            string finalPrompt = $"Create a 60-second long original music track based on this description: {prompt}. Ensure the musical style and any specific lyrics provided in the description are used exactly. The song MUST be sung in the language of the lyrics (e.g., Vietnamese). High quality, clean mix, suitable for background music. Do not imitate copyrighted artists.";

            var keys = ApiKeys.OrderBy(_ => Guid.NewGuid()).ToArray();
            string musicModel = "lyria-3-clip-preview";
            string lastError = "Music generation failed";

            foreach (var key in keys)
            {
                try
                {
                    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{musicModel}:generateContent?key={key}";

                    var payload = new JsonObject
                    {
                        ["contents"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["parts"] = new JsonArray { new JsonObject { ["text"] = finalPrompt } }
                            }
                        },
                        ["generationConfig"] = new JsonObject { ["candidateCount"] = 1 }
                    };

                    var content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(url, content);
                    string rawResponse = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode) continue;

                    using var doc = JsonDocument.Parse(rawResponse);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                    {
                        var parts = candidates[0].GetProperty("content").GetProperty("parts");
                        foreach (var part in parts.EnumerateArray())
                        {
                            if (part.TryGetProperty("inlineData", out var inlineData))
                            {
                                string base64Audio = inlineData.GetProperty("data").GetString() ?? "";
                                byte[] audioBytes = Convert.FromBase64String(base64Audio);

                                string musicDir = Path.Combine(webRootPath, "uploads", "music");
                                if (!Directory.Exists(musicDir)) Directory.CreateDirectory(musicDir);

                                string filename = $"music_{Guid.NewGuid().ToString("N").Substring(0, 10)}.mp3";
                                string savePath = Path.Combine(musicDir, filename);
                                string publicUrl = $"/uploads/music/{filename}";

                                await File.WriteAllBytesAsync(savePath, audioBytes);

                                return new JsonObject
                                {
                                    ["success"] = true,
                                    ["music_url"] = publicUrl,
                                    ["music_prompt"] = model.Prompt,
                                    ["music_duration"] = model.Duration,
                                    ["conversation_id"] = model.Conversation_Id,
                                    ["message"] = "Tạo nhạc thành công"
                                };
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                }
            }

            return new JsonObject { ["success"] = false, ["error"] = lastError };
        }
    }
}
