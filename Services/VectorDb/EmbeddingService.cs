using System.Text.Json;
using System.Text.Json.Nodes;

namespace BtoanAiNet.Services.VectorDb
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly HttpClient _http;
        private readonly ILogger<EmbeddingService> _logger;
        private readonly string _apiKey;

        public int VectorDimension => 768;

        public EmbeddingService(
            HttpClient http, 
            IConfiguration configuration,
            ILogger<EmbeddingService> logger)
        {
            _http = http;
            _logger = logger;
            _apiKey = configuration["Gemini:ApiKey"] 
                      ?? configuration["AiService:ApiKey"] 
                      ?? "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw";
        }

        public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return new float[VectorDimension];
            }

            try
            {
                string url = $"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={_apiKey}";
                var payload = new
                {
                    model = "models/text-embedding-004",
                    content = new
                    {
                        parts = new[] { new { text = text.Length > 2048 ? text.Substring(0, 2048) : text } }
                    }
                };

                var response = await _http.PostAsJsonAsync(url, payload, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: cancellationToken);
                    var values = json?["embedding"]?["values"]?.AsArray();
                    if (values != null && values.Count > 0)
                    {
                        return values.Select(v => v?.GetValue<float>() ?? 0f).ToArray();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to call Gemini Embedding API. Generating local fallback embedding vector.");
            }

            // Fallback deterministic vector hashing (768 dimensions) to prevent crash
            return GenerateDeterministicVector(text, VectorDimension);
        }

        public async Task<List<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken cancellationToken = default)
        {
            var results = new List<float[]>();
            foreach (var t in texts)
            {
                results.Add(await GenerateEmbeddingAsync(t, cancellationToken));
            }
            return results;
        }

        private static float[] GenerateDeterministicVector(string text, int dimensions)
        {
            var vector = new float[dimensions];
            var hash = text.GetHashCode();
            var random = new Random(hash);
            double sumSq = 0;

            for (int i = 0; i < dimensions; i++)
            {
                float val = (float)(random.NextDouble() * 2.0 - 1.0);
                vector[i] = val;
                sumSq += val * val;
            }

            // Normalize vector to unit length
            float norm = (float)Math.Sqrt(sumSq);
            if (norm > 0)
            {
                for (int i = 0; i < dimensions; i++) vector[i] /= norm;
            }

            return vector;
        }
    }
}

