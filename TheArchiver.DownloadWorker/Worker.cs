using System.Diagnostics;
using TheArchiver.Data.Context;
using TheArchiver.Data.Models;
using TheArhiver.DownloadPluginAPI;
using OpenTelemetry.Trace;
using TheArchiver.DownloadWorker.Helpers;

namespace TheArchiver.DownloadWorker;

public class Worker(IServiceProvider serviceProvider,
    IHostApplicationLifetime hostApplicationLifetime,
    ILogger<Worker> logger) : BackgroundService {
    
    public const string ActivitySourceName = "BackgroundDownload";
    private static readonly ActivitySource SActivitySource = new(ActivitySourceName);
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        using var activity = SActivitySource.StartActivity("Starting background download task", ActivityKind.Client);
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CacheDbContext>();
        
        var shareLocation = Environment.GetEnvironmentVariable("ShareLocation");
        var maxThreads = int.Parse(Environment.GetEnvironmentVariable("MaxConcurrentThreads") ?? "10");
        
        if(shareLocation == null)
            throw new Exception("ShareLocation environment variable not set");

        logger.LogInformation("Background download worker started successfully");
        
        while (!stoppingToken.IsCancellationRequested) {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            logger.LogDebug("Checking for items to download...");
            
            var queueItems = dbContext.DownloadQueueItems.ToList();
            if (queueItems.Count > 0)
            {
                logger.LogInformation("Found {Count} items in download queue", queueItems.Count);
            }
            
            foreach (var queueItem in queueItems) {
                try {
                    logger.LogInformation("Starting download: {Url}", queueItem.Url);
                    var downloadHandler = DownloadHandlerRegistry.GetDownloadHandlerForUrl(queueItem.Url);

                    if (downloadHandler == null)
                    {
                        logger.LogWarning("No download handler found for URL: {Url}", queueItem.Url);
                        var downloadResult = new IDownloadHandler.DownloadResult(false, $"No handler found for {queueItem.Url}");
                        
                        await NotificationHelper.SendNotification(
                            "Download Failed", 
                            downloadResult.Message, 
                            "x");
                        
                        dbContext.FailedDownloads.Add(new FailedDownloads() {
                            Url = queueItem.Url,
                            ErrorMessage = downloadResult.Message
                        });
                        dbContext.DownloadQueueItems.Remove(queueItem);
                        continue;
                    }

                    logger.LogDebug("Using download handler: {Handler}", downloadHandler.GetType().Name);
                    var saveResults = await downloadHandler.Download(queueItem.Url, shareLocation, maxThreads);
                    
                    if (saveResults.Success)
                    {
                        logger.LogInformation("Download completed successfully: {Message}", saveResults.Message);
                    }
                    else
                    {
                        logger.LogError("Download failed: {Message}", saveResults.Message);
                    }

                    await NotificationHelper.SendNotification(
                        saveResults.Success ? "Download Successful" : "Download Failed",
                        saveResults.Message,
                        saveResults.Success ? "white_check_mark" : "x");
                    
                    if (!saveResults.Success)
                        dbContext.FailedDownloads.Add(new FailedDownloads() {
                            Url = queueItem.Url,
                            ErrorMessage = saveResults.Message
                        });
                    dbContext.DownloadQueueItems.Remove(queueItem);
                }
                catch (Exception e) {
                    logger.LogError(e, "Exception during download: {Message}", e.Message);
                    
                    await NotificationHelper.SendNotification("Error Downloading", e.Message, "x");
                    // Save anything that succeeded
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }
}