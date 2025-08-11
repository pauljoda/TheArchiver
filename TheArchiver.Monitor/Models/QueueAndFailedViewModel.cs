using TheArchiver.Data.Models;

namespace TheArchiver.Monitor.Models;

public class QueueAndFailedViewModel
{
    public List<DownloadQueueItem> QueueItems { get; set; } = new();
    public List<FailedDownloads> FailedItems { get; set; } = new();
}


