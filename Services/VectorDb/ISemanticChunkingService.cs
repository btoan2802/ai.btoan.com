namespace BtoanAiNet.Services.VectorDb
{
    public class CodeChunk
    {
        public string FilePath { get; set; } = string.Empty;
        public string SymbolName { get; set; } = string.Empty;
        public string ChunkContent { get; set; } = string.Empty;
        public int StartLine { get; set; }
        public int EndLine { get; set; }
        public string Language { get; set; } = string.Empty;
    }

    public interface ISemanticChunkingService
    {
        List<CodeChunk> ChunkCodeFile(string relativePath, string content, int maxLines = 60, int overlapLines = 10);
    }
}
