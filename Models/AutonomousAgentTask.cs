using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("autonomous_agent_tasks")]
    public class AutonomousAgentTask
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("parent_task_id")]
        public int? ParentTaskId { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "Pending"; // Pending, Planning, Coding, Reviewing, Testing, Completed, Failed

        [Column("execution_order")]
        public int Order { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }

    [Table("project_memories")]
    public class ProjectMemory
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("memory_key")]
        public string Key { get; set; } = string.Empty; // Architecture, TechStack, UserPreference, ImportantFiles

        [Required]
        [Column("memory_value")]
        public string Value { get; set; } = string.Empty;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }
}
