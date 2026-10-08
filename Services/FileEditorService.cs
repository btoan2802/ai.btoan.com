using System.Text;

namespace BtoanAiNet.Services
{
    public interface IFileEditorService
    {
        Task<string> ReadFileContentAsync(string projectRoot, string relativePath);
        Task SaveFileContentAsync(string projectRoot, string relativePath, string content);
        bool FileExists(string projectRoot, string relativePath);
    }

    public class FileEditorService : IFileEditorService
    {
        public async Task<string> ReadFileContentAsync(string projectRoot, string relativePath)
        {
            string fullPath = Path.Combine(projectRoot, relativePath);
            if (!File.Exists(fullPath)) return string.Empty;
            return await File.ReadAllTextAsync(fullPath, Encoding.UTF8);
        }

        public async Task SaveFileContentAsync(string projectRoot, string relativePath, string content)
        {
            string fullPath = Path.Combine(projectRoot, relativePath);
            string? dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            await File.WriteAllTextAsync(fullPath, content, Encoding.UTF8);
        }

        public bool FileExists(string projectRoot, string relativePath)
        {
            string fullPath = Path.Combine(projectRoot, relativePath);
            return File.Exists(fullPath);
        }
    }
}
