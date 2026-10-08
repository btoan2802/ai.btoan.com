using BtoanAiNet.Models;
using BtoanAiNet.Repositories;

namespace BtoanAiNet.Services
{
    public interface ITrainingService
    {
        Task<List<AiTraining>> SearchTrainingAsync(string question);
        Task<AiTraining> SaveTrainingAsync(string question, string aiAnswer, string correctAnswer, int userId);
    }

    public class TrainingService : ITrainingService
    {
        private readonly ITrainingRepository _trainingRepository;

        public TrainingService(ITrainingRepository trainingRepository)
        {
            _trainingRepository = trainingRepository;
        }

        public async Task<List<AiTraining>> SearchTrainingAsync(string question)
        {
            return await _trainingRepository.SearchTrainingAsync(question);
        }

        public async Task<AiTraining> SaveTrainingAsync(string question, string aiAnswer, string correctAnswer, int userId)
        {
            return await _trainingRepository.AddTrainingAsync(question, aiAnswer, correctAnswer, userId);
        }
    }
}
