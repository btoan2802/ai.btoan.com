namespace BtoanAiNet.Services.VectorDb
{
    public interface IEmbeddingService
    {
        int VectorDimension { get; }
        Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken cancellationToken = default);
        Task<List<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken cancellationToken = default);
    }
}
