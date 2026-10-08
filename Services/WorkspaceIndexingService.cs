using System.Text;
using System.Text.RegularExpressions;

namespace BtoanAiNet.Services
{
    public class CodeSymbolSummary
    {
        public string FilePath { get; set; } = string.Empty;
        public List<string> Classes { get; set; } = new();
        public List<string> Methods { get; set; } = new();
        public List<string> Exports { get; set; } = new();
    }

    public interface IWorkspaceIndexingService
    {
        Task<string> GenerateWorkspaceIndexAsync(string workspacePath);
        Task<List<string>> QueryRelevantFilesAsync(string workspacePath, string userQuery);
    }

    public class WorkspaceIndexingService : IWorkspaceIndexingService
    {
        private static readonly HashSet<string> ExcludedDirs = new(StringComparer.OrdinalIgnoreCase)
        {
            "bin", "obj", ".git", ".vs", "node_modules", "dist", "build", ".gemini"
        };

        private static readonly HashSet<string> CodeExts = new(StringComparer.OrdinalIgnoreCase)
        {
            ".cs", ".cshtml", ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".sql"
        };

        public async Task<string> GenerateWorkspaceIndexAsync(string workspacePath)
        {
            if (!Directory.Exists(workspacePath)) return "Workspace path does not exist.";

            var symbols = new List<CodeSymbolSummary>();
            var files = Directory.GetFiles(workspacePath, "*.*", SearchOption.AllDirectories);

            foreach (var file in files)
            {
                var relPath = Path.GetRelativePath(workspacePath, file).Replace('\\', '/');
                if (IsExcluded(relPath)) continue;

                var ext = Path.GetExtension(file);
                if (!CodeExts.Contains(ext)) continue;

                var summary = await IndexFileSymbolsAsync(file, relPath);
                symbols.Add(summary);
            }

            var sb = new StringBuilder();
            sb.AppendLine("=== WORKSPACE CONTEXT INDEX ===");
            sb.AppendLine($"Total Code Files: {symbols.Count}");
            sb.AppendLine("Symbol Summary:");

            foreach (var sym in symbols.Take(100))
            {
                sb.AppendLine($"- File: {sym.FilePath}");
                if (sym.Classes.Count > 0)
                    sb.AppendLine($"  Classes/Types: {string.Join(", ", sym.Classes)}");
                if (sym.Methods.Count > 0)
                    sb.AppendLine($"  Methods/Functions: {string.Join(", ", sym.Methods.Take(6))}");
            }

            return sb.ToString();
        }

        public async Task<List<string>> QueryRelevantFilesAsync(string workspacePath, string userQuery)
        {
            var results = new List<string>();
            if (!Directory.Exists(workspacePath)) return results;

            var keywords = userQuery.ToLowerInvariant()
                .Split(new[] { ' ', ',', '.', '/', '\\', '_', '-', ':', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(k => k.Length > 2)
                .Distinct()
                .ToList();

            var files = Directory.GetFiles(workspacePath, "*.*", SearchOption.AllDirectories);
            foreach (var file in files)
            {
                var relPath = Path.GetRelativePath(workspacePath, file).Replace('\\', '/');
                if (IsExcluded(relPath)) continue;

                var lowerPath = relPath.ToLowerInvariant();
                if (keywords.Any(k => lowerPath.Contains(k)))
                {
                    results.Add(relPath);
                    continue;
                }

                // Check file content for keywords
                try
                {
                    var text = await File.ReadAllTextAsync(file);
                    var lowerText = text.ToLowerInvariant();
                    if (keywords.Any(k => lowerText.Contains(k)))
                    {
                        results.Add(relPath);
                    }
                }
                catch { }
            }

            if (results.Count == 0)
            {
                // Fallback to top files
                results.AddRange(files.Select(f => Path.GetRelativePath(workspacePath, f).Replace('\\', '/'))
                    .Where(f => !IsExcluded(f))
                    .Take(8));
            }

            return results.Take(12).ToList();
        }

        private async Task<CodeSymbolSummary> IndexFileSymbolsAsync(string fullPath, string relPath)
        {
            var summary = new CodeSymbolSummary { FilePath = relPath };
            try
            {
                var content = await File.ReadAllTextAsync(fullPath);
                if (content.Length > 50000) content = content.Substring(0, 50000);

                // C# / Java Class & Method extraction
                var classMatches = Regex.Matches(content, @"(?:class|interface|record|struct|enum)\s+([A-Za-z0-9_]+)");
                foreach (Match m in classMatches)
                {
                    if (m.Groups.Count > 1) summary.Classes.Add(m.Groups[1].Value);
                }

                var methodMatches = Regex.Matches(content, @"(?:public|private|protected|internal|static|async)\s+[\w<>,]+\s+([A-Za-z0-9_]+)\s*\(");
                foreach (Match m in methodMatches)
                {
                    if (m.Groups.Count > 1)
                    {
                        string name = m.Groups[1].Value;
                        if (name != "if" && name != "for" && name != "while" && name != "switch")
                        {
                            summary.Methods.Add(name);
                        }
                    }
                }

                // Python functions
                var pyFuncs = Regex.Matches(content, @"def\s+([A-Za-z0-9_]+)\s*\(");
                foreach (Match m in pyFuncs)
                {
                    if (m.Groups.Count > 1) summary.Methods.Add(m.Groups[1].Value);
                }

                // JS/TS functions & exports
                var jsFuncs = Regex.Matches(content, @"function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*=\s*\(");
                foreach (Match m in jsFuncs)
                {
                    string name = m.Groups[1].Success ? m.Groups[1].Value : (m.Groups[2].Success ? m.Groups[2].Value : "");
                    if (!string.IsNullOrEmpty(name)) summary.Exports.Add(name);
                }
            }
            catch { }

            return summary;
        }

        private bool IsExcluded(string relPath)
        {
            var parts = relPath.Split('/');
            return parts.Any(p => ExcludedDirs.Contains(p) || p.StartsWith('.'));
        }
    }
}
