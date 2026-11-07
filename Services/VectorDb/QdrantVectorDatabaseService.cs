using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BtoanAiNet.Services.VectorDb
{
    public class QdrantOptions
    {
        public string Endpoint { get; set; } = "http://localhost:6333";
        public string ApiKey { get; set; } = string.Empty;
    }

    public class QdrantVectorDatabaseService : IVectorDatabaseService
    {
        private readonly HttpClient _http;
        private readonly ILogger<QdrantVectorDatabaseService> _logger;

        public QdrantVectorDatabaseService(
            HttpClient http, 
            IConfiguration configuration,
            ILogger<QdrantVectorDatabaseService> logger)
        {
            _logger = logger;
            var opts = configuration.GetSection("Qdrant").Get<QdrantOptions>() ?? new QdrantOptions();
            _http = http;
            _http.BaseAddress = new Uri(opts.Endpoint.TrimEnd('/') + "/");
            if (!string.IsNullOrEmpty(opts.ApiKey))
            {
                _http.DefaultRequestHeaders.Add("api-key", opts.ApiKey);
            }
        }

        public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var res = await _http.GetAsync("healthz", cancellationToken);
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task EnsureCollectionAsync(string collectionName, int vectorDimension = 768, CancellationToken cancellationToken = default)
        {
            try
            {
                var checkRes = await _http.GetAsync($"collections/{collectionName}", cancellationToken);
                if (checkRes.IsSuccessStatusCode) return;

                var payload = new
                {
                    vectors = new
                    {
                        size = vectorDimension,
                        distance = "Cosine"
                    }
                };

                var createRes = await _http.PutAsJsonAsync($"collections/{collectionName}", payload, cancellationToken);
                createRes.EnsureSuccessStatusCode();
                _logger.LogInformation("Created Qdrant collection: {CollectionName} with dim {Dim}", collectionName, vectorDimension);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Qdrant collection creation skipped or failed for {CollectionName}", collectionName);
            }
        }

        public async Task UpsertPointsAsync(string collectionName, IEnumerable<VectorPoint> points, CancellationToken cancellationToken = default)
        {
            try
            {
                var qdrantPoints = points.Select(p => new
                {
                    id = p.Id,
                    vector = p.Vector,
                    payload = p.Payload
                }).ToList();

                if (qdrantPoints.Count == 0) return;

                var body = new { points = qdrantPoints };
                var res = await _http.PutAsJsonAsync($"collections/{collectionName}/points?wait=true", body, cancellationToken);
                res.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to upsert points into Qdrant collection {CollectionName}", collectionName);
            }
        }

        public async Task<List<VectorSearchResult>> SearchAsync(
            string collectionName, 
            float[] queryVector, 
            int topK = 5, 
            float minScore = 0.60f, 
            CancellationToken cancellationToken = default)
        {
            try
            {
                var body = new
                {
                    vector = queryVector,
                    limit = topK,
                    with_payload = true,
                    score_threshold = minScore
                };

                var res = await _http.PostAsJsonAsync($"collections/{collectionName}/points/search", body, cancellationToken);
                if (!res.IsSuccessStatusCode) return new List<VectorSearchResult>();

                var json = await res.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: cancellationToken);
                var results = new List<VectorSearchResult>();

                if (json?["result"] is JsonArray arr)
                {
                    foreach (var item in arr)
                    {
                        var id = item?["id"]?.ToString() ?? string.Empty;
                        var score = item?["score"]?.GetValue<float>() ?? 0f;
                        var payloadDict = new Dictionary<string, object>();

                        if (item?["payload"] is JsonObject payloadObj)
                        {
                            foreach (var kvp in payloadObj)
                            {
                                payloadDict[kvp.Key] = kvp.Value?.ToString() ?? string.Empty;
                            }
                        }

                        results.Add(new VectorSearchResult
                        {
                            Id = id,
                            Score = score,
                            Payload = payloadDict
                        });
                    }
                }

                return results;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Qdrant search error for collection {CollectionName}", collectionName);
                return new List<VectorSearchResult>();
            }
        }

        public async Task DeleteByFilterAsync(string collectionName, string filterKey, object filterValue, CancellationToken cancellationToken = default)
        {
            try
            {
                var body = new
                {
                    filter = new
                    {
                        must = new[]
                        {
                            new
                            {
                                key = filterKey,
                                match = new { value = filterValue }
                            }
                        }
                    }
                };

                await _http.PostAsJsonAsync($"collections/{collectionName}/points/delete", body, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete by filter in Qdrant {CollectionName}", collectionName);
            }
        }
    }
}
