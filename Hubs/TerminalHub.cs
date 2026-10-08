using Microsoft.AspNetCore.SignalR;

namespace BtoanAiNet.Hubs
{
    public class TerminalHub : Hub
    {
        public async Task JoinSessionGroup(int sessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        }

        public async Task LeaveSessionGroup(int sessionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        }
    }
}
