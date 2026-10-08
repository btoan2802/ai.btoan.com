using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Repositories
{
    public class MemoryRepository : IMemoryRepository
    {
        private readonly AppDbContext _context;

        public MemoryRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserMemory>> GetMemoryByUserIdAsync(int userId)
        {
            return await _context.UserMemories
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.Id)
                .ToListAsync();
        }

        public async Task<UserMemory> AddMemoryAsync(int userId, string memoryValue)
        {
            var mem = new UserMemory
            {
                UserId = userId,
                MemoryValue = memoryValue,
                CreatedAt = DateTime.UtcNow
            };
            _context.UserMemories.Add(mem);
            await _context.SaveChangesAsync();
            return mem;
        }
    }
}
