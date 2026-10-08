using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("terminal_sessions")]
    public class TerminalSession
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("command")]
        public string Command { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "Running"; // Running, Completed, Failed, Stopped, TimedOut

        [Column("stdout")]
        public string StdOut { get; set; } = string.Empty;

        [Column("stderr")]
        public string StdErr { get; set; } = string.Empty;

        [Column("exit_code")]
        public int? ExitCode { get; set; }

        [Column("started_at")]
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        [Column("finished_at")]
        public DateTime? FinishedAt { get; set; }

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }
}
