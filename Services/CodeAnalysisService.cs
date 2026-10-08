using System.Text;

namespace BtoanAiNet.Services
{
    public interface ICodeAnalysisService
    {
        Task<string> GetProjectSummaryAsync(string projectPath);
        Task<List<string>> FindRelevantFilesAsync(string projectPath, string userPrompt);
    }

    public class CodeAnalysisService : ICodeAnalysisService
    {
        private readonly IFileService _fileService;

        public CodeAnalysisService(IFileService fileService)
        {
            _fileService = fileService;
        }

        public async Task<string> GetProjectSummaryAsync(string projectPath)
        {
            var files = await _fileService.GetProjectFilesAsync(projectPath);
            var sb = new StringBuilder();
            sb.AppendLine($"Project Root: {projectPath}");
            sb.AppendLine("File Structure:");

            foreach (var f in files.Take(120))
            {
                sb.AppendLine($"- {f}");
            }

            if (files.Count > 120)
            {
                sb.AppendLine($"... and {files.Count - 120} more files.");
            }

            return sb.ToString();
        }

        public async Task<List<string>> FindRelevantFilesAsync(string projectPath, string userPrompt)
        {
            var files = await _fileService.GetProjectFilesAsync(projectPath);
            var relevant = new List<string>();

            var promptKeywords = userPrompt.ToLowerInvariant()
                .Split(new[] { ' ', ',', '.', '/', '\\', '_', '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 2)
                .ToList();

            foreach (var f in files)
            {
                var lowerFile = f.ToLowerInvariant();
                if (promptKeywords.Any(k => lowerFile.Contains(k)))
                {
                    relevant.Add(f);
                }
            }

            if (relevant.Count == 0)
            {
                // Default fallback to key controllers/services if no specific file matched keyword
                relevant.AddRange(files.Where(f => f.Contains("Controller") || f.Contains("Service")).Take(5));
            }

            return relevant.Take(10).ToList();
        }
    }
}
