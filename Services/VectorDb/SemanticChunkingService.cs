using System.Text.RegularExpressions;

namespace BtoanAiNet.Services.VectorDb
{
    public class SemanticChunkingService : ISemanticChunkingService
    {
        public List<CodeChunk> ChunkCodeFile(string relativePath, string content, int maxLines = 60, int overlapLines = 10)
        {
            var chunks = new List<CodeChunk>();
            if (string.IsNullOrWhiteSpace(content)) return chunks;

            var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            string ext = Path.GetExtension(relativePath).ToLowerInvariant();

            int currentLine = 0;
            while (currentLine < lines.Length)
            {
                int endLine = Math.Min(currentLine + maxLines, lines.Length);
                var slice = lines.Skip(currentLine).Take(endLine - currentLine).ToArray();
                string chunkText = string.Join("\n", slice);

                string symbolName = DetectPrimarySymbol(slice, ext);

                chunks.Add(new CodeChunk
                {
                    FilePath = relativePath.Replace('\\', '/'),
                    SymbolName = symbolName,
                    ChunkContent = chunkText,
                    StartLine = currentLine + 1,
                    EndLine = endLine,
                    Language = GetLanguageFromExt(ext)
                });

                if (endLine >= lines.Length) break;
                currentLine += (maxLines - overlapLines);
            }

            return chunks;
        }

        private static string DetectPrimarySymbol(string[] lines, string ext)
        {
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("//") || trimmed.StartsWith("/*") || trimmed.StartsWith("*"))
                    continue;

                // Match class, interface, method, function
                var classMatch = Regex.Match(trimmed, @"\b(class|interface|record|struct|enum)\s+([A-Za-z0-9_]+)");
                if (classMatch.Success) return classMatch.Groups[2].Value;

                var funcMatch = Regex.Match(trimmed, @"\b(public|private|protected|internal|async|function|def)?\s*([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(");
                if (funcMatch.Success && funcMatch.Groups[3].Value != "if" && funcMatch.Groups[3].Value != "while" && funcMatch.Groups[3].Value != "for")
                {
                    return funcMatch.Groups[3].Value;
                }
            }
            return "General";
        }

        private static string GetLanguageFromExt(string ext) => ext switch
        {
            ".cs" => "csharp",
            ".js" => "javascript",
            ".ts" => "typescript",
            ".py" => "python",
            ".html" or ".cshtml" => "html",
            ".css" => "css",
            ".json" => "json",
            ".sql" => "sql",
            _ => "text"
        };
    }
}

