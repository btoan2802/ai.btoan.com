using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace BtoanAiNet.Hubs
{
    public class WorkspaceHub : Hub
    {
        private static readonly ConcurrentDictionary<string, string> FileLocks = new();

        public async Task JoinProjectSession(int projectId, int userId)
        {
            string groupName = $"project-{projectId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            await Clients.Group(groupName).SendAsync("UserJoined", new { userId, connectionId = Context.ConnectionId });
        }

        public async Task LeaveProjectSession(int projectId, int userId)
        {
            string groupName = $"project-{projectId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            await Clients.Group(groupName).SendAsync("UserLeft", new { userId, connectionId = Context.ConnectionId });
        }

        public async Task RequestFileLock(int projectId, string filePath, int userId)
        {
            string lockKey = $"{projectId}:{filePath}";
            if (FileLocks.TryGetValue(lockKey, out string? ownerConnId) && ownerConnId != Context.ConnectionId)
            {
                await Clients.Caller.SendAsync("FileLockResponse", new { ok = false, message = "File is locked by another user." });
                return;
            }

            FileLocks[lockKey] = Context.ConnectionId;
            string groupName = $"project-{projectId}";
            await Clients.Group(groupName).SendAsync("FileLocked", new { filePath, userId, connectionId = Context.ConnectionId });
            await Clients.Caller.SendAsync("FileLockResponse", new { ok = true, filePath });
        }

        public async Task ReleaseFileLock(int projectId, string filePath, int userId)
        {
            string lockKey = $"{projectId}:{filePath}";
            FileLocks.TryRemove(lockKey, out _);
            string groupName = $"project-{projectId}";
            await Clients.Group(groupName).SendAsync("FileUnlocked", new { filePath, userId });
        }

        public async Task StreamCursorPosition(int projectId, string filePath, int lineNumber, int columnNumber, int userId)
        {
            string groupName = $"project-{projectId}";
            await Clients.OthersInGroup(groupName).SendAsync("CursorMoved", new { filePath, lineNumber, columnNumber, userId });
        }

        public async Task SendAiStreamChunk(int projectId, string chunkText, bool isComplete)
        {
            string groupName = $"project-{projectId}";
            await Clients.Group(groupName).SendAsync("ReceiveAiStreamChunk", new { chunkText, isComplete });
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            foreach (var kvp in FileLocks.Where(x => x.Value == Context.ConnectionId).ToList())
            {
                FileLocks.TryRemove(kvp.Key, out _);
            }
            return base.OnDisconnectedAsync(exception);
        }
    }
}
