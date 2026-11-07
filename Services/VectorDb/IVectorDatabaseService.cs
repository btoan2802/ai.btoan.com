namespace BtoanAiNet.Services.VectorDb
{
    public class VectorPoint
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public float[] Vector { get; set; } = Array.Empty<float>();
        public Dictionary<string, object> Payload { get; set; } = new();
    }

    public class VectorSearchResult
    {
        public string Id { get; set; } = string.Empty;
        public float Score { get; set; }
        public Dictionary<string, object> Payload { get; set; } = new();

        public T? GetPayloadValue<T>(string key)
        {
            if (Payload.TryGetValue(key, out var val))
            {
                if (val is T target) return target;
                if (val != null)
                {
                    try
                    {
                        return (T)Convert.ChangeType(val, typeof(T));
                    }
                    catch { }
                }
            }
            return default;
        }
    }

    public interface IVectorDatabaseService
    {
        Task EnsureCollectionAsync(string collectionName, int vectorDimension = 768, CancellationToken cancellationToken = default);
        Task UpsertPointsAsync(string collectionName, IEnumerable<VectorPoint> points, CancellationToken cancellationToken = default);
        Task<List<VectorSearchResult>> SearchAsync(string collectionName, float[] queryVector, int topK = 5, float minScore = 0.60f, CancellationToken cancellationToken = default);
        Task DeleteByFilterAsync(string collectionName, string filterKey, object filterValue, CancellationToken cancellationToken = default);
        Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
    }
}

