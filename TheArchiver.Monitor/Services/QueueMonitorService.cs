using Microsoft.EntityFrameworkCore;
using TheArchiver.Data.Context;
using TheArchiver.Data.Models;

namespace TheArchiver.Monitor.Services;

public class QueueMonitorService
{
    private readonly CacheDbContext _context;
    private readonly ILogger<QueueMonitorService> _logger;

    public QueueMonitorService(CacheDbContext context, ILogger<QueueMonitorService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<DownloadQueueItem>> GetQueueItemsAsync()
    {
        try
        {
            return await _context.DownloadQueueItems.ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching queue items");
            return new List<DownloadQueueItem>();
        }
    }

    public async Task<List<FailedDownloads>> GetFailedDownloadsAsync()
    {
        try
        {
            return await _context.FailedDownloads.ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching failed downloads");
            return new List<FailedDownloads>();
        }
    }

    public async Task<(int QueueCount, int FailedCount)> GetStatusCountsAsync()
    {
        try
        {
            var queueCount = await _context.DownloadQueueItems.CountAsync();
            var failedCount = await _context.FailedDownloads.CountAsync();
            return (queueCount, failedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching status counts");
            return (0, 0);
        }
    }

    public async Task<bool> RemoveQueueItemAsync(int id)
    {
        try
        {
            var item = await _context.DownloadQueueItems.FindAsync(id);
            if (item != null)
            {
                _context.DownloadQueueItems.Remove(item);
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing queue item {Id}", id);
            return false;
        }
    }

    public async Task<bool> RemoveFailedDownloadAsync(int id)
    {
        try
        {
            var item = await _context.FailedDownloads.FindAsync(id);
            if (item != null)
            {
                _context.FailedDownloads.Remove(item);
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing failed download {Id}", id);
            return false;
        }
    }

    public async Task<bool> RetryFailedDownloadAsync(int id)
    {
        try
        {
            var failedItem = await _context.FailedDownloads.FindAsync(id);
            if (failedItem != null)
            {
                // Add back to queue
                var queueItem = new DownloadQueueItem { Url = failedItem.Url };
                _context.DownloadQueueItems.Add(queueItem);
                
                // Remove from failed
                _context.FailedDownloads.Remove(failedItem);
                
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrying failed download {Id}", id);
            return false;
        }
    }
}
