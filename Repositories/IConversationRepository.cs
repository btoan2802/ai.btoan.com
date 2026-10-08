using BtoanAiNet.Models;

namespace BtoanAiNet.Repositories
{
    public interface IConversationRepository
    {
        Task<Conversation?> GetConversationByIdAsync(int id, int userId);
        Task<Conversation> CreateConversationAsync(int userId, string title);
        Task<List<Conversation>> GetConversationsByUserIdAsync(int userId);
        Task UpdateConversationTitleAsync(int id, string title);
        Task DeleteConversationAsync(int id);

        Task<List<Chat>> GetChatHistoryAsync(int conversationId, int userId, int limit = 20);
        Task<List<Chat>> GetMessagesByConversationIdAsync(int conversationId);
        Task<Chat> AddChatAsync(Chat chat);
    }
}
