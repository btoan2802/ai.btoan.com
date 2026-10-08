using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BtoanAiNet.Models
{
    [Table("project_files")]
    public class ProjectFile
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("relative_path")]
        [StringLength(500)]
        public string RelativePath { get; set; } = string.Empty;

        [Column("language")]
        [StringLength(50)]
        public string Language { get; set; } = "csharp";

        [Column("content")]
        public string Content { get; set; } = string.Empty;

        [Column("is_directory")]
        public bool IsDirectory { get; set; }

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }

        [JsonIgnore]
        public virtual ICollection<FileVersion> Versions { get; set; } = new List<FileVersion>();
    }
}
