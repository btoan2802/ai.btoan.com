using BtoanAiNet.Models;
using BtoanAiNet.Repositories;

namespace BtoanAiNet.Services
{
    public interface IMemoryService
    {
        Task<List<UserMemory>> GetMemoryByUserIdAsync(int userId);
        Task<UserMemory> SaveMemoryAsync(int userId, string memoryValue);
    }

    public class MemoryService : IMemoryService
    {
        private readonly IMemoryRepository _memoryRepository;

        public MemoryService(IMemoryRepository memoryRepository)
        {
            _memoryRepository = memoryRepository;
        }

        public async Task<List<UserMemory>> GetMemoryByUserIdAsync(int userId)
        {
            return await _memoryRepository.GetMemoryByUserIdAsync(userId);
        }

        public async Task<UserMemory> SaveMemoryAsync(int userId, string memoryValue)
        {
            return await _memoryRepository.AddMemoryAsync(userId, memoryValue);
        }
    }
}
