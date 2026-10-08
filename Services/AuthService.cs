using BtoanAiNet.Models;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IAuthService
    {
        Task<(bool Success, User? User, string? ErrorMessage)> LoginAsync(string username, string password);
        Task<(bool Success, string Status, string? Message)> RegisterAsync(string username, string password);
        Task<(bool HasProfile, string? FullName, DateOnly? Dob, string? Avatar)> CheckProfileAsync(int userId);
        Task<bool> UpdateNameAsync(int userId, string fullName, string dobStr);
        Task<bool> SaveFaceAsync(string username, string publicUrl, string descriptor);
    }

    public class AuthService : IAuthService
    {
        private readonly Repositories.IUserRepository _userRepository;

        public AuthService(Repositories.IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<(bool Success, User? User, string? ErrorMessage)> LoginAsync(string username, string password)
        {
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return (false, null, "Thiếu tài khoản hoặc mật khẩu");
            }

            var user = await _userRepository.GetByUsernameAsync(username);
            if (user == null || user.Password != password)
            {
                return (false, null, "Sai tài khoản hoặc mật khẩu");
            }

            return (true, user, null);
        }

        public async Task<(bool Success, string Status, string? Message)> RegisterAsync(string username, string password)
        {
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return (false, "error", "Thiếu username hoặc password");
            }

            if (password.Length < 6)
            {
                return (false, "error", "Mật khẩu phải tối thiểu 6 ký tự");
            }

            if (await _userRepository.ExistsUsernameAsync(username))
            {
                return (false, "error", "Username đã tồn tại");
            }

            var newUser = new User
            {
                Username = username,
                Password = password,
                CreatedAt = DateTime.UtcNow
            };

            await _userRepository.AddAsync(newUser);
            return (true, "ok", null);
        }

        public async Task<(bool HasProfile, string? FullName, DateOnly? Dob, string? Avatar)> CheckProfileAsync(int userId)
        {
            if (userId <= 0)
            {
                return (false, null, null, null);
            }

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
            {
                return (false, null, null, null);
            }

            bool hasProfile = !string.IsNullOrWhiteSpace(user.FullName);
            return (hasProfile, hasProfile ? user.FullName : null, user.Dob, user.Avatar);
        }

        public async Task<bool> UpdateNameAsync(int userId, string fullName, string dobStr)
        {
            if (userId <= 0 || string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(dobStr))
            {
                return false;
            }

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) return false;

            user.FullName = fullName.Trim();
            if (DateOnly.TryParse(dobStr, out var parsedDob))
            {
                user.Dob = parsedDob;
            }

            await _userRepository.UpdateAsync(user);
            return true;
        }

        public async Task<bool> SaveFaceAsync(string username, string publicUrl, string descriptor)
        {
            var user = await _userRepository.GetByUsernameAsync(username);
            if (user == null) return false;

            user.FaceImageUrl = publicUrl;
            user.FaceDescriptor = descriptor;
            user.FaceEnabled = 1;
            user.FaceUpdatedAt = DateTime.UtcNow;

            await _userRepository.UpdateAsync(user);
            return true;
        }
    }
}
