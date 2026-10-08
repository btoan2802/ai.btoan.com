using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("users")]
    public class User
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("username")]
        [StringLength(50)]
        public string? Username { get; set; }

        [Column("full_name")]
        [StringLength(255)]
        public string? FullName { get; set; }

        [Column("password")]
        [StringLength(255)]
        public string? Password { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("dob")]
        public DateOnly? Dob { get; set; }

        [Column("email")]
        [StringLength(255)]
        public string? Email { get; set; }

        [Column("google_id")]
        [StringLength(255)]
        public string? GoogleId { get; set; }

        [Column("avatar")]
        public string? Avatar { get; set; }

        [Column("face_enabled")]
        public int? FaceEnabled { get; set; }

        [Column("face_image_url")]
        public string? FaceImageUrl { get; set; }

        [Column("face_descriptor")]
        public string? FaceDescriptor { get; set; }

        [Column("face_updated_at")]
        public DateTime? FaceUpdatedAt { get; set; }
    }
}
