using System.IO.Compression;
using System.Text;
using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Services
{
    public interface IWorkspaceService
    {
        Task<List<Project>> GetUserProjectsAsync(int userId);
        Task<Project> CreateProjectAsync(int userId, string name, string template, string webRootPath);
        Task<Project> CreateProjectFromZipAsync(int userId, string name, Stream zipStream, string webRootPath);
        Task<Project> CreateProjectFromGitAsync(int userId, string name, string gitUrl, string webRootPath);
        Task<Project?> GetProjectByIdAsync(int projectId, int userId);
        Task<bool> ValidateProjectOwnershipAsync(int projectId, int userId);
        Task<string> GetProjectStoragePathAsync(int projectId, string webRootPath);
        Task SaveFileWithVersionAsync(int projectId, string relativePath, string content, string createdBy, string changeSummary, string webRootPath);
        Task<List<FileVersion>> GetFileVersionHistoryAsync(int projectId, string relativePath);
        Task<bool> RollbackFileVersionAsync(int versionId, string webRootPath);
        Task CreateItemAsync(int projectId, string relativePath, bool isDirectory, string webRootPath);
        Task RenameItemAsync(int projectId, string oldPath, string newPath, string webRootPath);
        Task DeleteItemAsync(int projectId, string relativePath, string webRootPath);
        Task<bool> DeleteProjectAsync(int projectId, int userId, string webRootPath);
        Task<byte[]> ExportProjectAsZipAsync(int projectId, int userId, string webRootPath);
        string SanitizePath(string storagePath, string relativePath);
    }

    public class WorkspaceService : IWorkspaceService
    {
        private readonly AppDbContext _context;

        public WorkspaceService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Project>> GetUserProjectsAsync(int userId)
        {
            return await _context.Projects
                .Where(p => p.UserId == userId || userId == 0)
                .OrderByDescending(p => p.UpdatedAt)
                .ToListAsync();
        }

        public async Task<Project> CreateProjectAsync(int userId, string name, string template, string webRootPath)
        {
            if (string.IsNullOrWhiteSpace(name)) name = "My Project";
            if (string.IsNullOrWhiteSpace(template)) template = "dotnet-mvc";

            var project = new Project
            {
                UserId = userId,
                Name = name.Trim(),
                Template = template,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            string relativeStorage = Path.Combine("uploads", "workspaces", userId.ToString(), project.Id.ToString()).Replace('\\', '/');
            project.StoragePath = relativeStorage;
            await _context.SaveChangesAsync();

            string absoluteStorage = Path.Combine(webRootPath, relativeStorage);
            if (!Directory.Exists(absoluteStorage))
            {
                Directory.CreateDirectory(absoluteStorage);
            }

            await InitializeTemplateFilesAsync(project.Id, absoluteStorage, template);

            return project;
        }

        public async Task<Project> CreateProjectFromZipAsync(int userId, string name, Stream zipStream, string webRootPath)
        {
            var project = await CreateProjectAsync(userId, name, "zip-imported", webRootPath);
            string storagePath = await GetProjectStoragePathAsync(project.Id, webRootPath);

            using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);
            foreach (var entry in archive.Entries)
            {
                if (string.IsNullOrEmpty(entry.Name)) continue;
                string fullPath = SanitizePath(storagePath, entry.FullName);
                string? dir = Path.GetDirectoryName(fullPath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
                entry.ExtractToFile(fullPath, overwrite: true);
            }

            return project;
        }

        public async Task<Project> CreateProjectFromGitAsync(int userId, string name, string gitUrl, string webRootPath)
        {
            var project = await CreateProjectAsync(userId, name, "git-imported", webRootPath);
            string storagePath = await GetProjectStoragePathAsync(project.Id, webRootPath);

            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "git",
                    Arguments = $"clone {gitUrl} .",
                    WorkingDirectory = storagePath,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var proc = System.Diagnostics.Process.Start(psi);
                if (proc != null) proc.WaitForExit(30000);
            }
            catch
            {
                await CreateFileInternalAsync(storagePath, "README.md", $"# Imported from Git\nURL: {gitUrl}\n");
            }

            return project;
        }

        public async Task<Project?> GetProjectByIdAsync(int projectId, int userId)
        {
            return await _context.Projects.FirstOrDefaultAsync(p => p.Id == projectId && (userId == 0 || p.UserId == userId));
        }

        public async Task<bool> ValidateProjectOwnershipAsync(int projectId, int userId)
        {
            if (userId == 0) return true; // System / Admin bypass
            var project = await _context.Projects.FindAsync(projectId);
            return project != null && project.UserId == userId;
        }

        public async Task<string> GetProjectStoragePathAsync(int projectId, string webRootPath)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null || string.IsNullOrEmpty(project.StoragePath))
            {
                return Path.Combine(webRootPath, "uploads", "workspaces", "default", projectId.ToString());
            }
            return Path.Combine(webRootPath, project.StoragePath);
        }

        public async Task SaveFileWithVersionAsync(int projectId, string relativePath, string content, string createdBy, string changeSummary, string webRootPath)
        {
            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            string absolutePath = SanitizePath(storagePath, relativePath);

            string? dir = Path.GetDirectoryName(absolutePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            await File.WriteAllTextAsync(absolutePath, content, Encoding.UTF8);

            var pFile = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == relativePath);
            if (pFile == null)
            {
                pFile = new ProjectFile
                {
                    ProjectId = projectId,
                    RelativePath = relativePath,
                    Language = DetectLanguage(relativePath),
                    Content = content,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.ProjectFiles.Add(pFile);
            }
            else
            {
                pFile.Content = content;
                pFile.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            int latestVersion = await _context.FileVersions
                .Where(v => v.ProjectFileId == pFile.Id)
                .Select(v => (int?)v.VersionNumber)
                .MaxAsync() ?? 0;

            var version = new FileVersion
            {
                ProjectFileId = pFile.Id,
                VersionNumber = latestVersion + 1,
                Content = content,
                CreatedBy = createdBy,
                ChangeSummary = changeSummary ?? "Updated code",
                CreatedAt = DateTime.UtcNow
            };

            _context.FileVersions.Add(version);

            var project = await _context.Projects.FindAsync(projectId);
            if (project != null) project.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        public async Task<List<FileVersion>> GetFileVersionHistoryAsync(int projectId, string relativePath)
        {
            var pFile = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == relativePath);
            if (pFile == null) return new List<FileVersion>();

            return await _context.FileVersions
                .Where(v => v.ProjectFileId == pFile.Id)
                .OrderByDescending(v => v.VersionNumber)
                .ToListAsync();
        }

        public async Task<bool> RollbackFileVersionAsync(int versionId, string webRootPath)
        {
            var version = await _context.FileVersions.FindAsync(versionId);
            if (version == null) return false;

            var pFile = await _context.ProjectFiles.FindAsync(version.ProjectFileId);
            if (pFile == null) return false;

            await SaveFileWithVersionAsync(pFile.ProjectId, pFile.RelativePath, version.Content, "ROLLBACK", $"Rollback to Version {version.VersionNumber}", webRootPath);
            return true;
        }

        public async Task CreateItemAsync(int projectId, string relativePath, bool isDirectory, string webRootPath)
        {
            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            string fullPath = SanitizePath(storagePath, relativePath);

            if (isDirectory)
            {
                if (!Directory.Exists(fullPath)) Directory.CreateDirectory(fullPath);
            }
            else
            {
                await SaveFileWithVersionAsync(projectId, relativePath, "", "USER", "Created new file", webRootPath);
            }
        }

        public async Task RenameItemAsync(int projectId, string oldPath, string newPath, string webRootPath)
        {
            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            string oldFull = SanitizePath(storagePath, oldPath);
            string newFull = SanitizePath(storagePath, newPath);

            if (File.Exists(oldFull))
            {
                File.Move(oldFull, newFull, overwrite: true);
                var pFile = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == oldPath);
                if (pFile != null)
                {
                    pFile.RelativePath = newPath;
                    pFile.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }
            else if (Directory.Exists(oldFull))
            {
                Directory.Move(oldFull, newFull);
            }
        }

        public async Task DeleteItemAsync(int projectId, string relativePath, string webRootPath)
        {
            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            string fullPath = SanitizePath(storagePath, relativePath);

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
                var pFile = await _context.ProjectFiles.FirstOrDefaultAsync(f => f.ProjectId == projectId && f.RelativePath == relativePath);
                if (pFile != null)
                {
                    _context.ProjectFiles.Remove(pFile);
                    await _context.SaveChangesAsync();
                }
            }
            else if (Directory.Exists(fullPath))
            {
                Directory.Delete(fullPath, recursive: true);
            }
        }

        public async Task<bool> DeleteProjectAsync(int projectId, int userId, string webRootPath)
        {
            if (!await ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return false;

            // Delete associated DB records
            var pFiles = await _context.ProjectFiles.Where(f => f.ProjectId == projectId).ToListAsync();
            var fileIds = pFiles.Select(f => f.Id).ToList();

            var versions = await _context.FileVersions.Where(v => fileIds.Contains(v.ProjectFileId)).ToListAsync();
            _context.FileVersions.RemoveRange(versions);
            _context.ProjectFiles.RemoveRange(pFiles);

            var codeChanges = await _context.CodeChanges.Where(c => c.ProjectId == projectId).ToListAsync();
            _context.CodeChanges.RemoveRange(codeChanges);

            var autoTasks = await _context.AutonomousAgentTasks.Where(t => t.ProjectId == projectId).ToListAsync();
            _context.AutonomousAgentTasks.RemoveRange(autoTasks);

            var teamTasks = await _context.TeamAgentTasks.Where(t => t.ProjectId == projectId).ToListAsync();
            _context.TeamAgentTasks.RemoveRange(teamTasks);

            var deployments = await _context.Deployments.Where(d => d.ProjectId == projectId).ToListAsync();
            _context.Deployments.RemoveRange(deployments);

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            // Delete storage directory from disk
            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            if (Directory.Exists(storagePath))
            {
                try
                {
                    Directory.Delete(storagePath, recursive: true);
                }
                catch { }
            }

            return true;
        }

        public async Task<byte[]> ExportProjectAsZipAsync(int projectId, int userId, string webRootPath)
        {
            if (!await ValidateProjectOwnershipAsync(projectId, userId))
                throw new UnauthorizedAccessException("Access Denied: You do not own this project.");

            string storagePath = await GetProjectStoragePathAsync(projectId, webRootPath);
            if (!Directory.Exists(storagePath))
                throw new DirectoryNotFoundException("Project storage directory not found.");

            using var memoryStream = new MemoryStream();
            ZipFile.CreateFromDirectory(storagePath, memoryStream);
            return memoryStream.ToArray();
        }

        public string SanitizePath(string storagePath, string relativePath)
        {
            string fullStorageDir = Path.GetFullPath(storagePath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string combined = Path.GetFullPath(Path.Combine(fullStorageDir, relativePath));

            if (!combined.StartsWith(fullStorageDir, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Path traversal security violation detected.");
            }

            return combined;
        }

        private async Task InitializeTemplateFilesAsync(int projectId, string storagePath, string template)
        {
            string norm = (template ?? string.Empty).ToLower().Trim();

            switch (norm)
            {
                case "empty":
                case "empty-project":
                    // Completely empty workspace: 0 initial files
                    break;

                case "react":
                    await SaveFileWithVersionAsync(projectId, "package.json", @"{
  ""name"": ""react-cloud-app"",
  ""version"": ""1.0.0"",
  ""dependencies"": {
    ""react"": ""^18.2.0"",
    ""react-dom"": ""^18.2.0""
  }
}", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "public/index.html", @"<!DOCTYPE html>
<html>
<head><title>React App</title></head>
<body><div id=""root""></div></body>
</html>", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "src/App.jsx", @"import React from 'react';
export default function App() { return <h1>Hello React Cloud Workspace!</h1>; }", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "src/index.js", @"import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);", "SYSTEM", "Initial Template", storagePath);
                    break;

                case "node":
                case "nodejs":
                    await SaveFileWithVersionAsync(projectId, "package.json", @"{
  ""name"": ""node-cloud-app"",
  ""version"": ""1.0.0"",
  ""main"": ""index.js"",
  ""scripts"": { ""start"": ""node index.js"" }
}", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "index.js", @"console.log('Hello Node.js Workspace!');\n", "SYSTEM", "Initial Template", storagePath);
                    break;

                case "html5":
                case "html":
                case "web":
                    await SaveFileWithVersionAsync(projectId, "index.html", @"<!DOCTYPE html>
<html lang=""vi"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Web App Studio</title>
    <link rel=""stylesheet"" href=""style.css"">
</head>
<body>
    <div class=""container"">
        <h1>Welcome to Btoan Cloud Web Studio</h1>
        <p>Start editing index.html, style.css, and script.js!</p>
        <button id=""clickBtn"">Click Me</button>
    </div>
    <script src=""script.js""></script>
</body>
</html>", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "style.css", @"body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #0f172a;
    color: #f8fafc;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}
.container {
    text-align: center;
    background: #1e293b;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
button {
    background: #6366f1;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 600;
}
button:hover { background: #4f46e5; }", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "script.js", @"document.getElementById('clickBtn').addEventListener('click', () => {
    alert('Hello from Btoan Cloud IDE!');
});", "SYSTEM", "Initial Template", storagePath);
                    break;

                case "java":
                    await SaveFileWithVersionAsync(projectId, "Main.java", @"public class Main {
    public static void main(String[] args) {
        System.out.println(""Hello Java Cloud Workspace!"");
        Calculator calc = new Calculator();
        System.out.println(""5 + 3 = "" + calc.add(5, 3));
    }
}

class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}", "SYSTEM", "Initial Template", storagePath);
                    break;

                case "python":
                    await SaveFileWithVersionAsync(projectId, "main.py", "print('Hello Python Workspace!')\n", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "requirements.txt", "# Dependencies list\n", "SYSTEM", "Initial Template", storagePath);
                    break;

                case "dotnet-mvc":
                case "aspnet-mvc":
                default:
                    await SaveFileWithVersionAsync(projectId, "MyProject.csproj", @"<Project Sdk=""Microsoft.NET.Sdk.Web"">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "Program.cs", @"var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.MapControllerRoute(
    name: ""default"",
    pattern: ""{controller=Home}/{action=Index}/{id?}"");
app.Run();", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "Controllers/HomeController.cs", @"using Microsoft.AspNetCore.Mvc;
namespace MyProject.Controllers {
    public class HomeController : Controller {
        public IActionResult Index() { return View(); }
    }
}", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "Models/ErrorViewModel.cs", @"namespace MyProject.Models {
    public class ErrorViewModel {
        public string? RequestId { get; set; }
    }
}", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "Views/Home/Index.cshtml", @"@{ ViewData[""Title""] = ""Home Page""; }
<h1>Welcome to ASP.NET MVC Cloud Workspace</h1>", "SYSTEM", "Initial Template", storagePath);
                    await SaveFileWithVersionAsync(projectId, "appsettings.json", @"{
  ""Logging"": {
    ""LogLevel"": {
      ""Default"": ""Information""
    }
  }
}", "SYSTEM", "Initial Template", storagePath);
                    break;
            }
        }

        private async Task CreateFileInternalAsync(string rootPath, string relativePath, string content)
        {
            string full = SanitizePath(rootPath, relativePath);
            string? dir = Path.GetDirectoryName(full);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            await File.WriteAllTextAsync(full, content, Encoding.UTF8);
        }

        private string DetectLanguage(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            return ext switch
            {
                ".cs" => "csharp",
                ".java" => "java",
                ".js" or ".jsx" => "javascript",
                ".ts" or ".tsx" => "typescript",
                ".html" or ".cshtml" => "html",
                ".css" => "css",
                ".sql" => "sql",
                ".py" => "python",
                ".json" => "json",
                _ => "plaintext"
            };
        }
    }
}
