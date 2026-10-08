using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("deployments")]
    public class Deployment
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("environment")]
        public string Environment { get; set; } = "Production"; // Development, Preview, Production

        [Required]
        [MaxLength(50)]
        [Column("provider")]
        public string Provider { get; set; } = "DockerContainer"; // DockerContainer, Kubernetes, Serverless

        [Required]
        [MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = "Building"; // Building, Deploying, Running, Failed, Stopped, Rollback

        [Required]
        [MaxLength(255)]
        [Column("url")]
        public string Url { get; set; } = string.Empty;

        [MaxLength(100)]
        [Column("container_id")]
        public string ContainerId { get; set; } = string.Empty;

        [Column("port")]
        public int Port { get; set; }

        [MaxLength(50)]
        [Column("detected_framework")]
        public string Framework { get; set; } = "ASP.NET Core";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }

    [Table("project_env_vars")]
    public class ProjectEnvironmentVariable
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("environment")]
        public string Environment { get; set; } = "Production"; // Development, Preview, Production

        [Required]
        [MaxLength(100)]
        [Column("key_name")]
        public string Key { get; set; } = string.Empty;

        [Required]
        [Column("encrypted_value")]
        public string EncryptedValue { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public virtual Project? Project { get; set; }
    }

    [Table("deployment_logs")]
    public class DeploymentLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("deployment_id")]
        public int DeploymentId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("step")]
        public string Step { get; set; } = string.Empty;

        [Required]
        [Column("message")]
        public string Message { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("log_level")]
        public string LogLevel { get; set; } = "INFO"; // INFO, WARN, ERROR

        [Column("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [ForeignKey("DeploymentId")]
        public virtual Deployment? Deployment { get; set; }
    }
}
