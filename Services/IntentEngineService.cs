using System.Text.Json;
using System.Text.Json.Nodes;

namespace BtoanAiNet.Services
{
    public interface IIntentEngineService
    {
        Task<JsonObject> AnalyzeIntentAsync(string userMessage, bool hasImages = false, bool hasFiles = false);
        string GetSystemProtection(JsonObject intentObj);
        Task<(bool Valid, string? Reason)> ValidateResponseAsync(JsonObject intentObj, string answer);
    }

    public class IntentEngineService : IIntentEngineService
    {
        private readonly HttpClient _httpClient;
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

        public IntentEngineService(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
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

        public async Task<JsonObject> AnalyzeIntentAsync(string userMessage, bool hasImages = false, bool hasFiles = false)
        {
            var keys = GetConfiguredApiKeys().OrderBy(_ => Guid.NewGuid()).ToArray();
            string prompt = $@"Analyze the following user message to identify their intent and constraints for an AI assistant.
Respond ONLY with a JSON object.

User Message: ""{userMessage}""
Has Images: {hasImages.ToString().ToLower()}
Has Files: {hasFiles.ToString().ToLower()}

CRITICAL: Look for these Vietnamese keywords which signal HARD or NEGATIVE constraints:
- ""không được"", ""đừng"", ""không"", ""chỉ"", ""giữ nguyên"", ""bắt buộc"", ""phải"", ""y chang"", ""giống"", ""dựa vào"" -> Add to hard_constraints
- ""không sửa phần khác"", ""đừng phá"", ""không tự thêm"", ""không bịa"", ""đọc kỹ source"", ""đúng như ảnh"", ""đúng như file"" -> Add to hard_constraints
- ""không chibi"", ""không anime"", ""không cartoon"" -> Add to negative_constraints

The JSON object must have these fields:
- task_type: ""text_generation"" | ""code_edit"" | ""image_generation"" | ""image_edit"" | ""identity_preserving_image_edit"" | ""ui_edit"" | ""file_export"" | ""troubleshooting"" | ""file_analysis""
- user_goal: string
- hard_constraints: array of strings
- negative_constraints: array of strings
- must_preserve: array of strings
- allowed_changes: array of strings
- forbidden_changes: array of strings
- has_reference_files: boolean
- has_reference_images: boolean
- needs_reference_image: boolean
- risk_of_wrong_inference: array of strings
- final_interpretation: string";

            var payload = new JsonObject
            {
                ["contents"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["parts"] = new JsonArray { new JsonObject { ["text"] = prompt } }
                    }
                },
                ["generationConfig"] = new JsonObject
                {
                    ["response_mime_type"] = "application/json"
                }
            };

            foreach (var key in keys)
            {
                try
                {
                    string url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}";
                    var content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(url, content);
                    if (!response.IsSuccessStatusCode) continue;

                    string responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                    {
                        var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                        if (!string.IsNullOrEmpty(text))
                        {
                            var parsed = JsonNode.Parse(text)?.AsObject();
                            if (parsed != null) return parsed;
                        }
                    }
                }
                catch
                {
                    // Failover next key
                }
            }

            // Fallback
            return new JsonObject
            {
                ["task_type"] = "text_generation",
                ["user_goal"] = userMessage,
                ["hard_constraints"] = new JsonArray(),
                ["negative_constraints"] = new JsonArray(),
                ["must_preserve"] = new JsonArray(),
                ["allowed_changes"] = new JsonArray(),
                ["forbidden_changes"] = new JsonArray(),
                ["has_reference_files"] = hasFiles,
                ["has_reference_images"] = hasImages,
                ["needs_reference_image"] = false,
                ["risk_of_wrong_inference"] = new JsonArray(),
                ["final_interpretation"] = userMessage
            };
        }

        public string GetSystemProtection(JsonObject intentObj)
        {
            string taskType = intentObj["task_type"]?.ToString() ?? "text_generation";
            string userGoal = intentObj["user_goal"]?.ToString() ?? "";
            string finalInterpretation = intentObj["final_interpretation"]?.ToString() ?? "";

            var protection = "\n\n### USER_INTENT_ADHERENCE_PROTOCOL (STRICT)\n";
            protection += "1. Explicit user instructions have the highest priority.\n";
            protection += "2. Negative instructions ('don't', 'no', 'avoid') must be respected absolutely.\n";
            protection += "3. Do not reinterpret the request into a different style or task. Do not 'improve' aesthetics if it violates constraints.\n";
            protection += "4. Preserve all parts the user did not ask to change.\n";
            protection += $"5. Current Task Type: {taskType}\n";

            if (intentObj["hard_constraints"] is JsonArray hardArr && hardArr.Count > 0)
            {
                protection += $"6. HARD CONSTRAINTS: {string.Join(", ", hardArr.Select(x => x?.ToString()))}\n";
            }
            if (intentObj["negative_constraints"] is JsonArray negArr && negArr.Count > 0)
            {
                protection += $"7. NEGATIVE CONSTRAINTS: {string.Join(", ", negArr.Select(x => x?.ToString()))}\n";
            }

            if (taskType == "image_edit" || taskType == "identity_preserving_image_edit")
            {
                protection += "10. IMAGE EDIT RULES: Use the provided reference image. Only modify the specific parts mentioned in 'allowed_changes'. If this is an identity-preserving task, keep the facial features and character identity exactly as they appear in the reference image. Do not change the art style unless requested.\n";
            }

            protection += $"12. FINAL INTERPRETATION: {finalInterpretation}\n";
            protection += "### END PROTOCOL\n";

            return protection;
        }

        public async Task<(bool Valid, string? Reason)> ValidateResponseAsync(JsonObject intentObj, string answer)
        {
            return await Task.FromResult<(bool Valid, string? Reason)>((true, null));
        }
    }
}
