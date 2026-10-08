using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BtoanAiNet.Models
{
    [Table("ai_training")]
    public class AiTraining
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("question")]
        public string? Question { get; set; }

        [Column("ai_answer")]
        public string? AiAnswer { get; set; }

        [Column("correct_answer")]
        public string? CorrectAnswer { get; set; }

        [Column("user_id")]
        public int? UserId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
