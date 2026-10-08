using System.Text;

namespace BtoanAiNet.Services
{
    public interface IFileService
    {
        Task<List<string>> GetProjectFilesAsync(string projectPath);
        Task<string> ReadFileAsync(string filePath);
        Task WriteFileAsync(string filePath, string content);
        bool FileExists(string filePath);
        string ComputeDiff(string originalText, string newText, string fileName);
    }

    public class FileService : IFileService
    {
        private static readonly HashSet<string> ExcludedDirectories = new(StringComparer.OrdinalIgnoreCase)
        {
            "bin", "obj", ".git", ".vs", ".idea", "node_modules", "wwwroot/lib"
        };

        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".cs", ".cshtml", ".json", ".css", ".js", ".md", ".txt", ".csproj", ".sql"
        };

        public Task<List<string>> GetProjectFilesAsync(string projectPath)
        {
            var result = new List<string>();
            if (!Directory.Exists(projectPath)) return Task.FromResult(result);

            ScanDirectory(projectPath, projectPath, result);
            return Task.FromResult(result);
        }

        private void ScanDirectory(string rootPath, string currentPath, List<string> result)
        {
            foreach (var dir in Directory.GetDirectories(currentPath))
            {
                var dirName = Path.GetFileName(dir);
                if (ExcludedDirectories.Contains(dirName) || dirName.StartsWith('.'))
                    continue;

                ScanDirectory(rootPath, dir, result);
            }

            foreach (var file in Directory.GetFiles(currentPath))
            {
                var ext = Path.GetExtension(file);
                if (AllowedExtensions.Contains(ext))
                {
                    var relativePath = Path.GetRelativePath(rootPath, file).Replace('\\', '/');
                    result.Add(relativePath);
                }
            }
        }

        public async Task<string> ReadFileAsync(string filePath)
        {
            if (!File.Exists(filePath)) return string.Empty;
            return await File.ReadAllTextAsync(filePath, Encoding.UTF8);
        }

        public async Task WriteFileAsync(string filePath, string content)
        {
            var dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            await File.WriteAllTextAsync(filePath, content, Encoding.UTF8);
        }

        public bool FileExists(string filePath)
        {
            return File.Exists(filePath);
        }

        public string ComputeDiff(string originalText, string newText, string fileName)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"--- a/{fileName}");
            sb.AppendLine($"+++ b/{fileName}");

            var origLines = originalText.Split('\n');
            var newLines = newText.Split('\n');

            int max = Math.Max(origLines.Length, newLines.Length);
            for (int i = 0; i < max; i++)
            {
                string origLine = i < origLines.Length ? origLines[i].TrimEnd('\r') : null;
                string newLine = i < newLines.Length ? newLines[i].TrimEnd('\r') : null;

                if (origLine == newLine)
                {
                    if (origLine != null) sb.AppendLine($"  {origLine}");
                }
                else
                {
                    if (origLine != null) sb.AppendLine($"- {origLine}");
                    if (newLine != null) sb.AppendLine($"+ {newLine}");
                }
            }

            return sb.ToString();
        }
    }
}
