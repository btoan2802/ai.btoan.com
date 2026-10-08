namespace BtoanAiNet.Services
{
    public interface IProjectRuntimeManagerService
    {
        Task<RuntimeStatusResult> StartProjectRuntimeAsync(int projectId, int userId, string webRoot);
        Task<bool> StopProjectRuntimeAsync(int projectId, int userId);
        Task<RuntimeStatusResult> RestartProjectRuntimeAsync(int projectId, int userId, string webRoot);
        Task<RuntimeStatusResult> GetProjectRuntimeStatusAsync(int projectId, int userId);
        Task<RuntimeLogsResult> GetProjectRuntimeLogsAsync(int projectId, int userId);
        Task<string> GetLivePreviewUrlAsync(int projectId, int userId);
    }

    public class RuntimeStatusResult
    {
        public int ProjectId { get; set; }
        public int? Pid { get; set; }
        public int Port { get; set; }
        public string Status { get; set; } = "Stopped"; // Building, Running, Stopped, Crashed, BuildFailed
        public string ProjectType { get; set; } = "Unknown"; // ASPNET, NodeJS, Python, StaticHTML
        public DateTime? StartTime { get; set; }
        public double MemoryMb { get; set; }
        public double CpuPercent { get; set; }
        public int CrashCount { get; set; }
        public string PreviewUrl { get; set; } = string.Empty;
    }

    public class RuntimeLogsResult
    {
        public int ProjectId { get; set; }
        public string StdOut { get; set; } = string.Empty;
        public string StdErr { get; set; } = string.Empty;
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }
}
