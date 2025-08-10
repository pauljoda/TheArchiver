using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using TheArchiver.Monitor.Services;

namespace TheArchiver.Monitor.Hubs;

public class ConsoleHub : Hub
{
    private readonly ILogger<ConsoleHub> _logger;
    private readonly IConsoleOutputService _consoleOutputService;
    private static readonly Dictionary<string, ClientInfo> _connectedClients = new();

    public ConsoleHub(ILogger<ConsoleHub> logger, IConsoleOutputService consoleOutputService)
    {
        _logger = logger;
        _consoleOutputService = consoleOutputService;
    }

    public override async Task OnConnectedAsync()
    {
        var clientInfo = new ClientInfo
        {
            ConnectionId = Context.ConnectionId,
            ConnectedAt = DateTime.UtcNow,
            UserAgent = Context.GetHttpContext()?.Request.Headers.UserAgent.ToString() ?? "Unknown",
            IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString() ?? "Unknown"
        };

        _connectedClients[Context.ConnectionId] = clientInfo;
        
        _logger.LogInformation("Console client connected: {ConnectionId} from {IpAddress}", 
            Context.ConnectionId, clientInfo.IpAddress);
        
        // Send connection confirmation
        await Clients.Caller.SendAsync("ConnectionEstablished", Context.ConnectionId);
        
        // Send recent messages to new client
        var recentMessages = await _consoleOutputService.GetRecentMessagesAsync(100);
        foreach (var message in recentMessages)
        {
            await Clients.Caller.SendAsync("ConsoleOutput", message.Level, message.Source, message.Message);
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connectedClients.TryGetValue(Context.ConnectionId, out var clientInfo))
        {
            var duration = DateTime.UtcNow - clientInfo.ConnectedAt;
            _logger.LogInformation("Console client disconnected: {ConnectionId} after {Duration:mm\\:ss}", 
                Context.ConnectionId, duration);
            _connectedClients.Remove(Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendConsoleOutput(string level, string source, string message)
    {
        // Validate input
        if (string.IsNullOrEmpty(message))
        {
            await Clients.Caller.SendAsync("Error", "Message cannot be empty");
            return;
        }

        // Broadcast to all clients
        await Clients.All.SendAsync("ConsoleOutput", level, source, message);
        
        _logger.LogDebug("Console output broadcast: {Level} from {Source}: {Message}", level, source, message);
    }

    public async Task JoinConsoleGroup(string groupName)
    {
        if (string.IsNullOrEmpty(groupName))
        {
            await Clients.Caller.SendAsync("Error", "Group name cannot be empty");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Client {ConnectionId} joined console group: {GroupName}", Context.ConnectionId, groupName);
        
        await Clients.Caller.SendAsync("GroupJoined", groupName);
    }

    public async Task LeaveConsoleGroup(string groupName)
    {
        if (string.IsNullOrEmpty(groupName))
        {
            await Clients.Caller.SendAsync("Error", "Group name cannot be empty");
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Client {ConnectionId} left console group: {GroupName}", Context.ConnectionId, groupName);
        
        await Clients.Caller.SendAsync("GroupLeft", groupName);
    }

    public async Task GetConnectionInfo()
    {
        if (_connectedClients.TryGetValue(Context.ConnectionId, out var clientInfo))
        {
            await Clients.Caller.SendAsync("ConnectionInfo", new
            {
                ConnectionId = clientInfo.ConnectionId,
                ConnectedAt = clientInfo.ConnectedAt,
                UserAgent = clientInfo.UserAgent,
                IpAddress = clientInfo.IpAddress,
                TotalClients = _connectedClients.Count
            });
        }
    }

    public async Task Ping()
    {
        await Clients.Caller.SendAsync("Pong", DateTime.UtcNow);
    }

    public async Task GetHealthStatus()
    {
        var isHealthy = await _consoleOutputService.IsHealthyAsync();
        await Clients.Caller.SendAsync("HealthStatus", new
        {
            IsHealthy = isHealthy,
            Timestamp = DateTime.UtcNow,
            ConnectedClients = _connectedClients.Count
        });
    }

    public static int GetConnectedClientsCount()
    {
        return _connectedClients.Count;
    }

    public static IEnumerable<ClientInfo> GetConnectedClients()
    {
        return _connectedClients.Values.ToList();
    }
}

public class ClientInfo
{
    public string ConnectionId { get; set; } = string.Empty;
    public DateTime ConnectedAt { get; set; }
    public string UserAgent { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
}
