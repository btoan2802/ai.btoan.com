using System.Text.Json.Serialization;

namespace BtoanAiNet.Services
{
    public class FileTreeNode
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("path")]
        public string Path { get; set; } = string.Empty;

        [JsonPropertyName("isDirectory")]
        public bool IsDirectory { get; set; }

        [JsonPropertyName("children")]
        public List<FileTreeNode>? Children { get; set; }
    }

    public interface IProjectScannerService
    {
        Task<FileTreeNode> GetProjectTreeAsync(string projectPath);
    }

    public class ProjectScannerService : IProjectScannerService
    {
        private static readonly HashSet<string> ExcludedDirs = new(StringComparer.OrdinalIgnoreCase)
        {
            "bin", "obj", ".git", ".vs", ".idea", "node_modules", ".gemini"
        };

        private static readonly HashSet<string> ExcludedBinaryExts = new(StringComparer.OrdinalIgnoreCase)
        {
            ".dll", ".exe", ".pdb", ".so", ".dylib", ".nupkg", ".cache"
        };

        public Task<FileTreeNode> GetProjectTreeAsync(string projectPath)
        {
            var root = new FileTreeNode
            {
                Name = Path.GetFileName(projectPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)),
                Path = "",
                IsDirectory = true,
                Children = new List<FileTreeNode>()
            };

            if (Directory.Exists(projectPath))
            {
                BuildTree(projectPath, projectPath, root);
            }

            return Task.FromResult(root);
        }

        private void BuildTree(string rootPath, string currentPath, FileTreeNode parentNode)
        {
            try
            {
                var dirInfo = new DirectoryInfo(currentPath);

                // Add Subdirectories
                foreach (var dir in dirInfo.GetDirectories().OrderBy(d => d.Name))
                {
                    if (ExcludedDirs.Contains(dir.Name) || dir.Name.StartsWith('.'))
                        continue;

                    var relativePath = Path.GetRelativePath(rootPath, dir.FullName).Replace('\\', '/');
                    var dirNode = new FileTreeNode
                    {
                        Name = dir.Name,
                        Path = relativePath,
                        IsDirectory = true,
                        Children = new List<FileTreeNode>()
                    };

                    BuildTree(rootPath, dir.FullName, dirNode);
                    parentNode.Children?.Add(dirNode);
                }

                // Add Files
                foreach (var file in dirInfo.GetFiles().OrderBy(f => f.Name))
                {
                    if (ExcludedBinaryExts.Contains(file.Extension))
                        continue;

                    var relativePath = Path.GetRelativePath(rootPath, file.FullName).Replace('\\', '/');
                    parentNode.Children?.Add(new FileTreeNode
                    {
                        Name = file.Name,
                        Path = relativePath,
                        IsDirectory = false
                    });
                }
            }
            catch { }
        }
    }
}
