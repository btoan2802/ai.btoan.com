using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("team_agent_tasks")]
    public class TeamAgentTask
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("assigned_agent")]
        public string AssignedAgent { get; set; } = string.Empty; // ProjectManager, Architect, Database, Backend, Frontend, Security, QA, CodeReview

        [Required]
        [MaxLength(255)]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("priority")]
        public string Priority { get; set; } = "Medium"; // Critical, High, Medium, Low

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "Pending"; // Pending, Working, Completed, Failed

        [Column("execution_order")]
        public int Order { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("completed_at")]
        public DateTime? CompletedAt { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }

    [Table("agent_team_messages")]
    public class AgentTeamMessage
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("team_task_id")]
        public int? TeamTaskId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("from_agent")]
        public string FromAgent { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("to_agent")]
        public string ToAgent { get; set; } = string.Empty;

        [Required]
        [Column("message")]
        public string Message { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }

    [Table("project_knowledge_bases")]
    public class ProjectKnowledgeBase
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("topic")]
        public string Topic { get; set; } = string.Empty; // Architecture, DatabaseSchema, ImportantFiles, Decisions, KnownBugs

        [Required]
        [Column("details")]
        public string Details { get; set; } = string.Empty;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }
}
