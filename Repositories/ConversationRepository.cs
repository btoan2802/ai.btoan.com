using BtoanAiNet.Data;
using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Repositories
{
    public class ConversationRepository : IConversationRepository
    {
        private readonly AppDbContext _context;

        public ConversationRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Conversation?> GetConversationByIdAsync(int id, int userId)
        {
            return await _context.Conversations.FirstOrDefaultAsync(c => c.Id == id && (userId == 0 || c.UserId == userId));
        }

        public async Task<Conversation> CreateConversationAsync(int userId, string title)
        {
            var conv = new Conversation
            {
                UserId = userId,
                Title = title,
                CreatedAt = DateTime.UtcNow
            };
            _context.Conversations.Add(conv);
            await _context.SaveChangesAsync();
            return conv;
        }

        public async Task<List<Conversation>> GetConversationsByUserIdAsync(int userId)
        {
            return await _context.Conversations
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.Id)
                .ToListAsync();
        }

        public async Task UpdateConversationTitleAsync(int id, string title)
        {
            var conv = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == id);
            if (conv != null)
            {
                conv.Title = title;
                await _context.SaveChangesAsync();
            }
        }

        public async Task DeleteConversationAsync(int id)
        {
            var chats = await _context.Chats.Where(c => c.ConversationId == id).ToListAsync();
            _context.Chats.RemoveRange(chats);

            var conv = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == id);
            if (conv != null)
            {
                _context.Conversations.Remove(conv);
            }

            await _context.SaveChangesAsync();
        }

        public async Task<List<Chat>> GetChatHistoryAsync(int conversationId, int userId, int limit = 20)
        {
            return await _context.Chats
                .Where(c => c.ConversationId == conversationId && (userId == 0 || c.UserId == userId))
                .OrderBy(c => c.Id)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<List<Chat>> GetMessagesByConversationIdAsync(int conversationId)
        {
            return await _context.Chats
                .Where(c => c.ConversationId == conversationId)
                .OrderBy(c => c.Id)
                .ToListAsync();
        }

        public async Task<Chat> AddChatAsync(Chat chat)
        {
            _context.Chats.Add(chat);
            await _context.SaveChangesAsync();
            return chat;
        }
    }
}
