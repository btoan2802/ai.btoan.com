namespace BtoanAiNet.Services
{
    public interface IDiffService
    {
        string GenerateUnifiedDiff(string oldContent, string newContent, string filePath);
        List<DiffHunkDto> ParseDiffHunks(string diffText);
        string ApplyPartialHunks(string oldContent, string diffText, List<int> acceptedHunkIndices);
        SecurityReviewResult PerformSecurityInspection(string codeContent);
    }

    public class DiffHunkDto
    {
        public int Index { get; set; }
        public string Header { get; set; } = string.Empty;
        public List<string> Lines { get; set; } = new();
        public int OldStartLine { get; set; }
        public int NewStartLine { get; set; }
    }

    public class SecurityReviewResult
    {
        public int CriticalCount { get; set; }
        public int WarningCount { get; set; }
        public int SuggestionCount { get; set; }
        public List<string> Findings { get; set; } = new();
        public bool IsBlocked => CriticalCount > 0;
    }
}
