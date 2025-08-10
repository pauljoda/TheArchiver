using System.Diagnostics;
using TheArchiver.Data.Context;
using TheArchiver.Data.Models;
using TheArhiver.DownloadPluginAPI;
using OpenTelemetry.Trace;
using TheArchiver.DownloadWorker.Helpers;

namespace TheArchiver.DownloadWorker;

public class Worker(IServiceProvider serviceProvider,
    IHostApplicationLifetime hostApplicationLifetime) : BackgroundService {
    
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

        await ConsoleOutputService.SendInformationAsync("Worker", "Background download worker started successfully");
        
        while (!stoppingToken.IsCancellationRequested) {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            await ConsoleOutputService.SendDebugAsync("Worker", "Checking for items to download...");
            
            var queueItems = dbContext.DownloadQueueItems.ToList();
            if (queueItems.Count > 0)
            {
                await ConsoleOutputService.SendInformationAsync("Worker", $"Found {queueItems.Count} items in download queue");
            }
            
            foreach (var queueItem in queueItems) {
                try {
                    await ConsoleOutputService.SendInformationAsync("Worker", $"Starting download: {queueItem.Url}");
                    var downloadHandler = DownloadHandlerRegistry.GetDownloadHandlerForUrl(queueItem.Url);

                    if (downloadHandler == null)
                    {
                        await ConsoleOutputService.SendWarningAsync("Worker", $"No download handler found for URL: {queueItem.Url}");
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

                    await ConsoleOutputService.SendDebugAsync("Worker", $"Using download handler: {downloadHandler.GetType().Name}");
                    var saveResults = await downloadHandler.Download(queueItem.Url, shareLocation, maxThreads);
                    
                    if (saveResults.Success)
                    {
                        await ConsoleOutputService.SendInformationAsync("Worker", $"Download completed successfully: {saveResults.Message}");
                    }
                    else
                    {
                        await ConsoleOutputService.SendErrorAsync("Worker", $"Download failed: {saveResults.Message}");
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
                    await ConsoleOutputService.SendErrorAsync("Worker", $"Exception during download: {e.Message}");
                    await ConsoleOutputService.SendDebugAsync("Worker", $"Stack trace: {e.StackTrace}");
                    
                    await NotificationHelper.SendNotification("Error Downloading", e.Message, "x");
                    // Save anything that succeeded
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }
}