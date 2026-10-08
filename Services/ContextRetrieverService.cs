using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public class ContextRetrieverService : IContextRetrieverService
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public ContextRetrieverService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task<List<ProjectFile>> GetRelevantFilesAsync(int projectId, string prompt, int maxFiles = 5)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var allFiles = await dbContext.ProjectFiles
                .Where(f => f.ProjectId == projectId && !f.IsDirectory)
                .ToListAsync();

            if (allFiles.Count == 0) return new List<ProjectFile>();

            var keywords = ExtractKeywords(prompt);

            var scoredFiles = allFiles.Select(file =>
            {
                int score = 0;
                string lowerPath = file.RelativePath.ToLowerInvariant();

                foreach (var kw in keywords)
                {
                    if (lowerPath.Contains(kw)) score += 5;
                }

                if (lowerPath.Contains("program.cs") || lowerPath.Contains("appsettings.json")) score += 1;

                return new { File = file, Score = score };
            })
            .OrderByDescending(x => x.Score)
            .Take(maxFiles)
            .Select(x => x.File)
            .ToList();

            return scoredFiles;
        }

        public async Task<string> GetProjectMemorySummaryAsync(int projectId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var memories = await dbContext.ProjectMemories
                .Where(m => m.ProjectId == projectId)
                .ToListAsync();

            if (memories.Count == 0) return "Project Tech Stack: ASP.NET Core MVC, EF Core, SQL Server";

            return string.Join("; ", memories.Select(m => $"{m.Key}: {m.Value}"));
        }

        public async Task SaveProjectMemoryAsync(int projectId, string key, string value)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var existing = await dbContext.ProjectMemories.FirstOrDefaultAsync(m => m.ProjectId == projectId && m.Key == key);
            if (existing != null)
            {
                existing.Value = value;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                dbContext.ProjectMemories.Add(new ProjectMemory
                {
                    ProjectId = projectId,
                    Key = key,
                    Value = value,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            await dbContext.SaveChangesAsync();
        }

        private static List<string> ExtractKeywords(string prompt)
        {
            char[] separators = new[] { ' ', ',', '.', '!', '?', '-', '_', '/', '\\' };
            var rawTokens = prompt.ToLowerInvariant().Split(separators, StringSplitOptions.RemoveEmptyEntries);

            var stopWords = new HashSet<string> { "a", "an", "the", "create", "add", "make", "build", "update", "fix", "chức", "năng", "tạo", "sửa", "lỗi" };

            return rawTokens.Where(t => t.Length > 2 && !stopWords.Contains(t)).ToList();
        }
    }
}
