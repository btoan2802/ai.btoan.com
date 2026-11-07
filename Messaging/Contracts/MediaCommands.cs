namespace BtoanAiNet.Messaging.Contracts
{
    public enum MediaType
    {
        Image,
        Video,
        Music,
        ImageEdit
    }

    public record MediaGenerationCommand
    {
        public Guid JobId { get; init; } = Guid.NewGuid();
        public int UserId { get; init; }
        public int? ProjectId { get; init; }
        public int? ConversationId { get; init; }
        public MediaType Type { get; init; }
        public string Prompt { get; init; } = string.Empty;
        public Dictionary<string, string> Parameters { get; init; } = new();
        public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    }

    public record MediaJobStatusEvent
    {
        public Guid JobId { get; init; }
        public int UserId { get; init; }
        public int? ProjectId { get; init; }
        public string Status { get; init; } = string.Empty; // "Started", "Processing", "Completed", "Failed"
        public int ProgressPercent { get; init; }
        public string? ResultUrl { get; init; }
        public string? ErrorMessage { get; init; }
        public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    }
}

