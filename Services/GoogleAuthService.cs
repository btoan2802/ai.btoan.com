using System.Net.Http;
using System.Text.Json;
using BtoanAiNet.Models;
using BtoanAiNet.Repositories;

namespace BtoanAiNet.Services
{
    public interface IGoogleAuthService
    {
        Task<User?> AuthenticateGoogleTokenAsync(string token);
    }

    public class GoogleAuthService : IGoogleAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly HttpClient _httpClient;

        public GoogleAuthService(IUserRepository userRepository, HttpClient httpClient)
        {
            _userRepository = userRepository;
            _httpClient = httpClient;
        }

        public async Task<User?> AuthenticateGoogleTokenAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;

            try
            {
                var response = await _httpClient.GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={token}");
                if (!response.IsSuccessStatusCode) return null;

                var jsonString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(jsonString);
                var root = doc.RootElement;

                if (!root.TryGetProperty("email", out var emailProp)) return null;

                string email = emailProp.GetString() ?? "";
                string googleId = root.TryGetProperty("sub", out var subProp) ? subProp.GetString() ?? "" : "";
                string name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? "" : "";

                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(googleId)) return null;

                // 1. Find by google_id
                var user = await _userRepository.GetByGoogleIdAsync(googleId);
                if (user != null)
                {
                    return user;
                }

                // 2. Find by email
                user = await _userRepository.GetByEmailAsync(email);
                if (user != null)
                {
                    user.GoogleId = googleId;
                    if (!string.IsNullOrEmpty(name)) user.FullName = name;
                    await _userRepository.UpdateAsync(user);
                    return user;
                }

                // 3. Create new user
                var newUser = new User
                {
                    Email = email,
                    FullName = name,
                    GoogleId = googleId,
                    Username = email,
                    CreatedAt = DateTime.UtcNow
                };

                return await _userRepository.AddAsync(newUser);
            }
            catch
            {
                return null;
            }
        }
    }
}
