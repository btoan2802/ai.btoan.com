using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    public enum AgentTaskStatus
    {
        IDLE,
        ANALYZING,
        PLANNING,
        WAITING_APPROVAL,
        APPLYING_CHANGES,
        BUILDING,
        COMPLETED,
        FAILED
    }

    [Table("agent_tasks")]
    public class AgentTask
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("prompt")]
        public string Prompt { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = AgentTaskStatus.IDLE.ToString();

        [Column("summary")]
        public string Summary { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }

        public virtual ICollection<AgentMessage> Messages { get; set; } = new List<AgentMessage>();
        public virtual ICollection<AgentChange> Changes { get; set; } = new List<AgentChange>();
    }

    [Table("agent_messages")]
    public class AgentMessage
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("agent_task_id")]
        public int AgentTaskId { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("role")]
        public string Role { get; set; } = "user"; // user, assistant, system

        [Required]
        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("AgentTaskId")]
        public virtual AgentTask? AgentTask { get; set; }
    }

    [Table("agent_changes")]
    public class AgentChange
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("agent_task_id")]
        public int AgentTaskId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [Column("old_content")]
        public string OldContent { get; set; } = string.Empty;

        [Column("new_content")]
        public string NewContent { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("change_type")]
        public string ChangeType { get; set; } = "Modify"; // Create, Modify, Delete

        [ForeignKey("AgentTaskId")]
        public virtual AgentTask? AgentTask { get; set; }
    }
}
