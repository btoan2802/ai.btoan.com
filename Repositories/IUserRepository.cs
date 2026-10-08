using BtoanAiNet.Models;

namespace BtoanAiNet.Repositories
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(int id);
        Task<User?> GetByUsernameAsync(string username);
        Task<User?> GetByEmailAsync(string email);
        Task<User?> GetByGoogleIdAsync(string googleId);
        Task<User> AddAsync(User user);
        Task UpdateAsync(User user);
        Task<bool> ExistsUsernameAsync(string username);
    }
}
