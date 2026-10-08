using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("project_versions")]
    public class ProjectVersion
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Column("parent_version_id")]
        public int? ParentVersionId { get; set; }

        [Column("version_number")]
        public int VersionNumber { get; set; }

        [Required]
        [MaxLength(255)]
        [Column("commit_message")]
        public string CommitMessage { get; set; } = string.Empty;

        [Column("created_by_agent")]
        public bool CreatedByAgent { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }

        [ForeignKey("ParentVersionId")]
        public virtual ProjectVersion? ParentVersion { get; set; }

        public virtual ICollection<FileSnapshot> Snapshots { get; set; } = new List<FileSnapshot>();
        public virtual ICollection<FileChangeHistory> Histories { get; set; } = new List<FileChangeHistory>();
    }

    [Table("file_snapshots")]
    public class FileSnapshot
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_version_id")]
        public int ProjectVersionId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        [Column("file_hash")]
        public string FileHash { get; set; } = string.Empty; // SHA256

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectVersionId")]
        public virtual ProjectVersion? ProjectVersion { get; set; }
    }

    [Table("file_change_histories")]
    public class FileChangeHistory
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_version_id")]
        public int ProjectVersionId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("action")]
        public string Action { get; set; } = "UPDATE"; // CREATE, UPDATE, DELETE

        [MaxLength(64)]
        [Column("old_hash")]
        public string? OldHash { get; set; }

        [MaxLength(64)]
        [Column("new_hash")]
        public string? NewHash { get; set; }

        [ForeignKey("ProjectVersionId")]
        public virtual ProjectVersion? ProjectVersion { get; set; }
    }
}
