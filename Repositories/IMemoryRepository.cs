using BtoanAiNet.Models;

namespace BtoanAiNet.Repositories
{
    public interface IMemoryRepository
    {
        Task<List<UserMemory>> GetMemoryByUserIdAsync(int userId);
        Task<UserMemory> AddMemoryAsync(int userId, string memoryValue);
    }
}
