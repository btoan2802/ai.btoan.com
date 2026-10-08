using BtoanAiNet.Models;

namespace BtoanAiNet.Repositories
{
    public interface ITrainingRepository
    {
        Task<List<AiTraining>> SearchTrainingAsync(string question, int limit = 3);
        Task<AiTraining> AddTrainingAsync(string question, string aiAnswer, string correctAnswer, int userId);
    }
}
