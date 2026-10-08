using BtoanAiNet.Models;

namespace BtoanAiNet.Services
{
    public interface IWorkspaceEditService
    {
        Task<bool> ApplyChangesAsync(int taskId, int userId, string webRoot);
        Task<bool> RejectChangesAsync(int taskId, int userId);
    }
}
