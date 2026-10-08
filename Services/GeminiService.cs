using System.Text.Json;
using System.Text.Json.Nodes;

namespace BtoanAiNet.Services
{
    public interface IGeminiService
    {
        Task<(bool Success, JsonObject? ResponseData, string? RawResponse, string? ErrorMessage)> GenerateContentAsync(string model, JsonObject payload);
        Task<string> GenerateTextAsync(string prompt);
    }

    public class GeminiService : IGeminiService
    {
        private readonly HttpClient _httpClient;
        private static readonly string[] ApiKeys = new[]
        {
            "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
            "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
            "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
            "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
            "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
            "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
            "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
        };

        public GeminiService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> GenerateTextAsync(string prompt)
        {
            var payload = new JsonObject
            {
                ["contents"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["parts"] = new JsonArray
                        {
                            new JsonObject { ["text"] = prompt }
                        }
                    }
                }
            };

            var res = await GenerateContentAsync("gemini-2.5-flash", payload);
            if (res.Success && res.ResponseData != null)
            {
                try
                {
                    var text = res.ResponseData["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(text)) return text;
                }
                catch { }
            }
            return string.Empty;
        }

        public async Task<(bool Success, JsonObject? ResponseData, string? RawResponse, string? ErrorMessage)> GenerateContentAsync(string model, JsonObject payload)
        {
            if (string.IsNullOrWhiteSpace(model)) model = "gemini-2.5-flash";

            var keys = ApiKeys.OrderBy(_ => Guid.NewGuid()).ToArray();

            string requestJson = payload.ToJsonString();
            
            foreach (var key in keys)
            {
                try
                {
                    string url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}";
                    var content = new StringContent(requestJson, System.Text.Encoding.UTF8, "application/json");

                    var response = await _httpClient.PostAsync(url, content);
                    string rawResponse = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode) continue;

                    var jsonNode = JsonNode.Parse(rawResponse)?.AsObject();
                    if (jsonNode != null && jsonNode.ContainsKey("candidates"))
                    {
                        return (true, jsonNode, rawResponse, null);
                    }
                }
                catch
                {
                    // Continue failover
                }
            }

            return (false, null, null, "All API keys failed");
        }
    }
}
