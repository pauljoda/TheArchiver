using Microsoft.AspNetCore.SignalR;
using TheArchiver.Monitor.Hubs;

namespace TheArchiver.Monitor.Services;

public class NotificationService
{
    private readonly IHubContext<MonitorHub> _hubContext;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IHubContext<MonitorHub> hubContext, ILogger<NotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyQueueUpdatedAsync()
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("QueueUpdated");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying queue update");
        }
    }

    public async Task NotifyFailedDownloadAsync(string url, string errorMessage)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("DownloadFailed", url, errorMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying failed download");
        }
    }

    public async Task NotifyDownloadStartedAsync(string url)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("DownloadStarted", url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying download started");
        }
    }

    public async Task NotifyDownloadCompletedAsync(string url)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("DownloadCompleted", url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying download completed");
        }
    }
}
