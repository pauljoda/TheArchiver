using Microsoft.AspNetCore.SignalR;

namespace TheArchiver.Monitor.Hubs;

public class MonitorHub : Hub
{
    private readonly ILogger<MonitorHub> _logger;

    public MonitorHub(ILogger<MonitorHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
