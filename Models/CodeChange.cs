using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("code_changes")]
    public class CodeChange
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("agent_task_id")]
        public int AgentTaskId { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [Column("old_content")]
        public string OldContent { get; set; } = string.Empty;

        [Column("new_content")]
        public string NewContent { get; set; } = string.Empty;

        [Column("diff_text")]
        public string DiffText { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = "Pending"; // Pending, Accepted, Rejected, Applied

        [Column("ai_comment")]
        public string AiComment { get; set; } = string.Empty;

        [Column("security_warning_count")]
        public int SecurityWarningCount { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("AgentTaskId")]
        public virtual AgentTask? AgentTask { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }
}
