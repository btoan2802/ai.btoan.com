using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BtoanAiNet.Models
{
    [Table("file_versions")]
    public class FileVersion
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_file_id")]
        public int ProjectFileId { get; set; }

        [Column("version_number")]
        public int VersionNumber { get; set; }

        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Column("change_summary")]
        [StringLength(255)]
        public string? ChangeSummary { get; set; }

        [Column("created_by")]
        [StringLength(50)]
        public string CreatedBy { get; set; } = "USER";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        [ForeignKey("ProjectFileId")]
        public virtual ProjectFile? ProjectFile { get; set; }
    }
}
