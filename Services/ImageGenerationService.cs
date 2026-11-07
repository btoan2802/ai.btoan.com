using System.Text.Json;
using System.Text.Json.Nodes;
using BtoanAiNet.Repositories;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IImageGenerationService
    {
        Task<JsonObject> GenerateImageAsync(ImageGenerationRequestModel model);
        Task<JsonObject> EditImageAsync(EditImageRequestModel model, string webRootPath);
        Task<JsonObject> GetLastImageAsync(int conversationId);
    }

    public class ImageGenerationService : IImageGenerationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConversationRepository _conversationRepository;
        private readonly IIntentEngineService _intentEngineService;
        private readonly IConfiguration _configuration;

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

        private static readonly Dictionary<string, string> AnimalDict = new(StringComparer.OrdinalIgnoreCase)
        {
            { "ngựa", "horse" }, { "rồng", "dragon" }, { "tê giác", "rhinoceros" }, { "rhino", "rhinoceros" },
            { "chó", "dog" }, { "cún", "puppy" }, { "mèo", "cat" }, { "hổ", "tiger" }, { "cọp", "tiger" },
            { "sư tử", "lion" }, { "voi", "elephant" }, { "gấu", "bear" }, { "rắn", "snake" }, { "khỉ", "monkey" },
            { "trâu", "buffalo" }, { "bò", "cow" }, { "heo", "pig" }, { "lợn", "pig" }, { "sói", "wolf" },
            { "thỏ", "rabbit" }, { "đại bàng", "eagle" }, { "phượng hoàng", "phoenix" }, { "xe", "car" },
            { "ô tô", "car" }, { "xe máy", "motorbike" }, { "máy bay", "airplane" }, { "thuyền", "ship" },
            { "tàu", "boat" }, { "robot", "robot" }, { "thành phố", "city" }, { "núi", "mountain" }, { "biển", "ocean" }
        };

        private static readonly HashSet<string> StyleWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "a", "an", "the", "realistic", "illustration", "image", "photo", "picture",
            "beautiful", "high", "quality", "detailed", "cinematic", "artwork", "style",
            "hd", "4k", "8k", "genimage", "editimage", "strict", "instructions", "primary",
            "prompt", "drawing", "render", "digital", "art", "ultra", "photorealistic"
        };

        private static string CleanPromptForAI(string prompt)
        {
            Console.WriteLine("[BEFORE CLEAN PROMPT] " + prompt);

            string lower = prompt.ToLowerInvariant();
            foreach (var kvp in AnimalDict)
            {
                if (lower.Contains(kvp.Key))
                {
                    string dictResult = kvp.Value;
                    Console.WriteLine("[AFTER CLEAN PROMPT] " + dictResult);
                    return dictResult;
                }
            }

            string clean = System.Text.RegularExpressions.Regex.Replace(prompt, @"\[GENIMAGE\]|\[EDITIMAGE\]|STRICT INSTRUCTIONS:|PRIMARY PROMPT:", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            var words = System.Text.RegularExpressions.Regex.Replace(clean, @"[^\w\s]", "")
                .Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 1)
                .ToList();

            var filtered = words.Where(w => !StyleWords.Contains(w)).ToList();
            if (filtered.Count == 0) filtered = words;

            string cleanedResult = string.Join(" ", filtered);
            if (string.IsNullOrWhiteSpace(cleanedResult)) cleanedResult = "art";

            Console.WriteLine("[AFTER CLEAN PROMPT] " + cleanedResult);
            return cleanedResult;
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, string> _lastImagePrompts = new();

        private static readonly string[] ExplicitSubjectKeywords = new[]
        {
            "chó", "dog", "puppy", "mèo", "cat", "kitten", "rồng", "dragon", "tê giác", "rhinoceros", "rhino",
            "voi", "elephant", "hổ", "tiger", "cọp", "sư tử", "lion", "gấu", "bear", "chim", "bird",
            "cá", "fish", "trâu", "buffalo", "bò", "cow", "heo", "lợn", "pig", "sói", "wolf", "thỏ", "rabbit",
            "khỉ", "monkey", "rắn", "snake", "đại bàng", "eagle", "phượng hoàng", "phoenix",
            "xe", "car", "ô tô", "xe máy", "motorbike", "máy bay", "airplane", "thuyền", "ship", "tàu", "boat",
            "robot", "thành phố", "city", "núi", "mountain", "biển", "ocean", "người", "person", "man", "woman",
            "cô gái", "girl", "chàng trai", "boy", "nhà", "house"
        };

        private static bool HasExplicitSubject(string prompt)
        {
            if (string.IsNullOrWhiteSpace(prompt)) return false;
            string lower = prompt.ToLowerInvariant();
            foreach (var sub in ExplicitSubjectKeywords)
            {
                if (lower.Contains(sub)) return true;
            }
            return false;
        }

        public ImageGenerationService(
            HttpClient httpClient,
            IConversationRepository conversationRepository,
            IIntentEngineService intentEngineService,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _conversationRepository = conversationRepository;
            _intentEngineService = intentEngineService;
            _configuration = configuration;
        }

        private List<string> GetConfiguredApiKeys()
        {
            var keys = new List<string>();
            string? singleKey = _configuration["Gemini:ApiKey"];
            if (!string.IsNullOrWhiteSpace(singleKey)) keys.Add(singleKey.Trim());

            var arrayKeys = _configuration.GetSection("Gemini:ApiKeys").Get<string[]>();
            if (arrayKeys != null)
            {
                keys.AddRange(arrayKeys.Where(k => !string.IsNullOrWhiteSpace(k)).Select(k => k.Trim()));
            }

            string? envKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
            if (!string.IsNullOrWhiteSpace(envKey)) keys.Add(envKey.Trim());

            keys.AddRange(ApiKeys);
            return keys.Distinct().ToList();
        }

        public async Task<JsonObject> GenerateImageAsync(ImageGenerationRequestModel model)
        {
            string prompt = model.Prompt?.Trim() ?? "";
            if (string.IsNullOrEmpty(prompt))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Prompt is required" };
            }

            Console.WriteLine("[IMAGE CONTEXT BEFORE] " + prompt);

            int cid = model.Conversation_Id;
            if (cid > 0 && !HasExplicitSubject(prompt) && _lastImagePrompts.TryGetValue(cid, out var lastContext) && !string.IsNullOrWhiteSpace(lastContext))
            {
                string lowerPrompt = prompt.ToLowerInvariant();
                var matchCount = System.Text.RegularExpressions.Regex.Match(lowerPrompt, @"\d+");
                if (matchCount.Success)
                {
                    string suffix = lastContext.EndsWith("s", StringComparison.OrdinalIgnoreCase) ? "" : "s";
                    prompt = $"Create {matchCount.Value} {lastContext}{suffix}";
                }
                else if (lowerPrompt.Contains("đứng") || lowerPrompt.Contains("stand"))
                {
                    prompt = $"{lastContext} standing";
                }
                else if (lowerPrompt.Contains("to hơn") || lowerPrompt.Contains("bigger"))
                {
                    prompt = $"bigger {lastContext}";
                }
                else
                {
                    prompt = $"{lastContext} {prompt}";
                }
            }

            Console.WriteLine("[IMAGE CONTEXT AFTER] " + prompt);

            string aspectRatio = model.Aspect_Ratio?.Trim() ?? "1:1";
            var allowedRatios = new[] { "1:1", "16:9", "9:16", "4:3", "3:4" };
            if (!allowedRatios.Contains(aspectRatio)) aspectRatio = "1:1";

            var intentObj = await _intentEngineService.AnalyzeIntentAsync(prompt);
            string protection = _intentEngineService.GetSystemProtection(intentObj);

            string refinedPrompt = $"STRICT INSTRUCTIONS: {protection}\n\nPRIMARY PROMPT: {prompt}";
            Console.WriteLine("[IMAGE API PROMPT] " + refinedPrompt);
            Console.WriteLine("[IMAGE API FALLBACK KEYWORD] " + CleanPromptForAI(prompt));

            var keys = GetConfiguredApiKeys().OrderBy(_ => Guid.NewGuid()).ToArray();
            string modelName = "gemini-2.5-flash-image";
            string lastError = "Unknown Gemini API error";

            foreach (var key in keys)
            {
                try
                {
                    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={Uri.EscapeDataString(key)}";

                    var payload = new JsonObject
                    {
                        ["contents"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["parts"] = new JsonArray { new JsonObject { ["text"] = refinedPrompt } }
                            }
                        },
                        ["generationConfig"] = new JsonObject
                        {
                            ["imageConfig"] = new JsonObject
                            {
                                ["aspectRatio"] = aspectRatio
                            }
                        }
                    };

                    var content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(url, content);
                    string rawResponse = await response.Content.ReadAsStringAsync();
                    Console.WriteLine("[IMAGE API RESPONSE] Status: " + (int)response.StatusCode + " Body: " + (rawResponse.Length > 200 ? rawResponse.Substring(0, 200) + "..." : rawResponse));

                    if (!response.IsSuccessStatusCode)
                    {
                        lastError = $"API Error (HTTP {(int)response.StatusCode}): {rawResponse}";
                        continue;
                    }

                    using var doc = JsonDocument.Parse(rawResponse);
                    var root = doc.RootElement;

                    string? imageBase64 = null;
                    string mimeType = "image/png";

                    if (root.TryGetProperty("candidates", out var candidates))
                    {
                        foreach (var candidate in candidates.EnumerateArray())
                        {
                            if (candidate.TryGetProperty("content", out var contentElem) &&
                                contentElem.TryGetProperty("parts", out var parts))
                            {
                                foreach (var part in parts.EnumerateArray())
                                {
                                    if (part.TryGetProperty("inlineData", out var inlineData))
                                    {
                                        imageBase64 = inlineData.GetProperty("data").GetString();
                                        mimeType = inlineData.TryGetProperty("mimeType", out var m) ? m.GetString() ?? "image/png" : "image/png";
                                        break;
                                    }
                                    if (part.TryGetProperty("inline_data", out var inlineDataUnderscore))
                                    {
                                        imageBase64 = inlineDataUnderscore.GetProperty("data").GetString();
                                        mimeType = inlineDataUnderscore.TryGetProperty("mime_type", out var m) ? m.GetString() ?? "image/png" : "image/png";
                                        break;
                                    }
                                }
                            }
                            if (imageBase64 != null) break;
                        }
                    }

                    if (imageBase64 != null)
                    {
                        if (cid > 0)
                        {
                            _lastImagePrompts[cid] = CleanPromptForAI(prompt);
                        }
                        return new JsonObject
                        {
                            ["success"] = true,
                            ["mimeType"] = mimeType,
                            ["imageBase64"] = imageBase64
                        };
                    }
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                }
            }

            // Fallback to high quality image generation if Gemini API hits Quota Exceeded (HTTP 429 / 403)
            try
            {
                string keywords = CleanPromptForAI(prompt);
                string searchPrompt = (!string.IsNullOrWhiteSpace(prompt) && prompt.Length > 5 && prompt.Length < 400) ? prompt : keywords;
                string encodedPrompt = Uri.EscapeDataString(searchPrompt);

                byte[]? imgBytes = null;
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"https://image.pollinations.ai/prompt/{encodedPrompt}?width=1024&height=1024&nologo=true");
                    req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        var readBytes = await res.Content.ReadAsByteArrayAsync();
                        if (readBytes != null && readBytes.Length > 1000)
                        {
                            imgBytes = readBytes;
                        }
                    }
                }
                catch { }

                if (imgBytes == null || imgBytes.Length < 10000)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"https://loremflickr.com/1024/1024/{Uri.EscapeDataString(keywords)}");
                        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            var readBytes = await res.Content.ReadAsByteArrayAsync();
                            if (readBytes != null && readBytes.Length > 10000) imgBytes = readBytes;
                        }
                    }
                    catch { }
                }

                if (imgBytes == null || imgBytes.Length < 10000)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"https://source.unsplash.com/1024x1024/?{Uri.EscapeDataString(keywords)}");
                        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            imgBytes = await res.Content.ReadAsByteArrayAsync();
                        }
                    }
                    catch { }
                }

                if (imgBytes != null && imgBytes.Length > 0)
                {
                    if (cid > 0)
                    {
                        _lastImagePrompts[cid] = CleanPromptForAI(prompt);
                    }
                    return new JsonObject
                    {
                        ["success"] = true,
                        ["mimeType"] = "image/jpeg",
                        ["imageBase64"] = Convert.ToBase64String(imgBytes)
                    };
                }
            }
            catch { }

            return new JsonObject { ["success"] = false, ["error"] = "Không thể vẽ ảnh vào lúc này. Vui lòng thử lại sau ít phút." };
        }

        public async Task<JsonObject> EditImageAsync(EditImageRequestModel model, string webRootPath)
        {
            string prompt = model.Prompt?.Trim() ?? "";
            string baseImage = model.Image?.Trim() ?? "";

            if (string.IsNullOrEmpty(prompt) || string.IsNullOrEmpty(baseImage))
            {
                return new JsonObject { ["success"] = false, ["error"] = "Prompt and Base Image are required" };
            }

            string cleanBase64 = "";
            if (baseImage.StartsWith("/uploads/"))
            {
                string localPath = Path.Combine(webRootPath, baseImage.TrimStart('/', '\\'));
                if (File.Exists(localPath))
                {
                    byte[] bytes = await File.ReadAllBytesAsync(localPath);
                    cleanBase64 = Convert.ToBase64String(bytes);
                }
                else
                {
                    return new JsonObject { ["success"] = false, ["error"] = $"Reference image file not found: {baseImage}" };
                }
            }
            else
            {
                cleanBase64 = System.Text.RegularExpressions.Regex.Replace(baseImage, @"^data:image/[^;]+;base64,", "");
            }

            var intentObj = await _intentEngineService.AnalyzeIntentAsync(prompt, true);
            string protection = _intentEngineService.GetSystemProtection(intentObj);

            var keys = GetConfiguredApiKeys().OrderBy(_ => Guid.NewGuid()).ToArray();
            string modelName = "gemini-2.5-flash-image";
            string lastError = "Unknown Gemini Edit API error";

            foreach (var key in keys)
            {
                try
                {
                    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={Uri.EscapeDataString(key)}";

                    var payload = new JsonObject
                    {
                        ["contents"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["role"] = "user",
                                ["parts"] = new JsonArray
                                {
                                    new JsonObject { ["text"] = $"PROTOCOL:\n{protection}\n\nTASK: Please edit the following image based on this description: {prompt}" },
                                    new JsonObject
                                    {
                                        ["inline_data"] = new JsonObject
                                        {
                                            ["mime_type"] = "image/png",
                                            ["data"] = cleanBase64
                                        }
                                    }
                                }
                            }
                        },
                        ["generationConfig"] = new JsonObject
                        {
                            ["imageConfig"] = new JsonObject { ["aspectRatio"] = "1:1" }
                        }
                    };

                    var content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(url, content);
                    string rawResponse = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        lastError = $"API Error (HTTP {(int)response.StatusCode}): {rawResponse}";
                        continue;
                    }

                    using var doc = JsonDocument.Parse(rawResponse);
                    var root = doc.RootElement;

                    string? imageBase64 = null;
                    string mimeType = "image/png";

                    if (root.TryGetProperty("candidates", out var candidates))
                    {
                        foreach (var candidate in candidates.EnumerateArray())
                        {
                            if (candidate.TryGetProperty("content", out var contentElem) &&
                                contentElem.TryGetProperty("parts", out var parts))
                            {
                                foreach (var part in parts.EnumerateArray())
                                {
                                    if (part.TryGetProperty("inlineData", out var inlineData))
                                    {
                                        imageBase64 = inlineData.GetProperty("data").GetString();
                                        mimeType = inlineData.TryGetProperty("mimeType", out var m) ? m.GetString() ?? "image/png" : "image/png";
                                        break;
                                    }
                                    if (part.TryGetProperty("inline_data", out var inlineDataUnderscore))
                                    {
                                        imageBase64 = inlineDataUnderscore.GetProperty("data").GetString();
                                        mimeType = inlineDataUnderscore.TryGetProperty("mime_type", out var m) ? m.GetString() ?? "image/png" : "image/png";
                                        break;
                                    }
                                }
                            }
                            if (imageBase64 != null) break;
                        }
                    }

                    if (imageBase64 != null)
                    {
                        string editDir = Path.Combine(webRootPath, "uploads", "edits");
                        if (!Directory.Exists(editDir)) Directory.CreateDirectory(editDir);

                        string ext = mimeType.Contains("/") ? mimeType.Split('/')[1] : "png";
                        string filename = $"edit_{Guid.NewGuid().ToString("N").Substring(0, 10)}.{ext}";
                        string savePath = Path.Combine(editDir, filename);
                        string publicUrl = $"/uploads/edits/{filename}";

                        byte[] imgBytes = Convert.FromBase64String(imageBase64);
                        await File.WriteAllBytesAsync(savePath, imgBytes);

                        return new JsonObject
                        {
                            ["success"] = true,
                            ["mimeType"] = mimeType,
                            ["imageBase64"] = imageBase64,
                            ["publicUrl"] = publicUrl
                        };
                    }
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                }
            }

            // Fallback for image editing if Gemini API hits Quota Exceeded (HTTP 429 / 403)
            try
            {
                string keywords = CleanPromptForAI(prompt);
                string encodedPrompt = Uri.EscapeDataString(keywords);

                byte[]? imgBytes = null;
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"https://image.pollinations.ai/prompt/{encodedPrompt}");
                    req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        var readBytes = await res.Content.ReadAsByteArrayAsync();
                        if (readBytes != null && readBytes.Length > 10000)
                        {
                            imgBytes = readBytes;
                        }
                    }
                }
                catch { }

                if (imgBytes == null || imgBytes.Length < 10000)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"https://loremflickr.com/1024/1024/{Uri.EscapeDataString(keywords)}");
                        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            var readBytes = await res.Content.ReadAsByteArrayAsync();
                            if (readBytes != null && readBytes.Length > 10000) imgBytes = readBytes;
                        }
                    }
                    catch { }
                }

                if (imgBytes == null || imgBytes.Length < 10000)
                {
                    try
                    {
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"https://source.unsplash.com/1024x1024/?{Uri.EscapeDataString(keywords)}");
                        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                        var res = await _httpClient.SendAsync(req);
                        if (res.IsSuccessStatusCode)
                        {
                            imgBytes = await res.Content.ReadAsByteArrayAsync();
                        }
                    }
                    catch { }
                }

                if (imgBytes != null && imgBytes.Length > 0)
                {
                    string editDir = Path.Combine(webRootPath, "uploads", "edits");
                    if (!Directory.Exists(editDir)) Directory.CreateDirectory(editDir);

                    string filename = $"edit_{Guid.NewGuid().ToString("N").Substring(0, 10)}.jpg";
                    string savePath = Path.Combine(editDir, filename);
                    string publicUrl = $"/uploads/edits/{filename}";

                    await File.WriteAllBytesAsync(savePath, imgBytes);

                    return new JsonObject
                    {
                        ["success"] = true,
                        ["mimeType"] = "image/jpeg",
                        ["imageBase64"] = Convert.ToBase64String(imgBytes),
                        ["publicUrl"] = publicUrl
                    };
                }
            }
            catch { }

            return new JsonObject { ["success"] = false, ["error"] = "Không thể chỉnh sửa ảnh vào lúc này. Vui lòng thử lại sau ít phút." };
        }

        public async Task<JsonObject> GetLastImageAsync(int conversationId)
        {
            if (conversationId <= 0)
            {
                return new JsonObject { ["success"] = false, ["error"] = "Missing conversation_id" };
            }

            var chats = await _conversationRepository.GetMessagesByConversationIdAsync(conversationId);
            var lastChatWithImages = chats
                .Where(c => !string.IsNullOrEmpty(c.Images) && c.Images != "[]")
                .OrderByDescending(c => c.Id)
                .FirstOrDefault();

            if (lastChatWithImages != null && !string.IsNullOrEmpty(lastChatWithImages.Images))
            {
                try
                {
                    var images = JsonSerializer.Deserialize<List<string>>(lastChatWithImages.Images);
                    if (images != null && images.Count > 0)
                    {
                        return new JsonObject
                        {
                            ["success"] = true,
                            ["image_url"] = images[0]
                        };
                    }
                }
                catch { }
            }

            return new JsonObject { ["success"] = false, ["error"] = "No images found in history" };
        }
    }
}
