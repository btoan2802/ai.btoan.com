using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Repositories
{
    public class TrainingRepository : ITrainingRepository
    {
        private readonly AppDbContext _context;

        public TrainingRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<AiTraining>> SearchTrainingAsync(string question, int limit = 3)
        {
            if (string.IsNullOrWhiteSpace(question)) return new List<AiTraining>();

            return await _context.AiTrainings
                .Where(t => t.Question != null && t.Question.Contains(question))
                .Take(limit)
                .ToListAsync();
        }

        public async Task<AiTraining> AddTrainingAsync(string question, string aiAnswer, string correctAnswer, int userId)
        {
            var training = new AiTraining
            {
                Question = question,
                AiAnswer = aiAnswer,
                CorrectAnswer = correctAnswer,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.AiTrainings.Add(training);
            await _context.SaveChangesAsync();
            return training;
        }
    }
}
