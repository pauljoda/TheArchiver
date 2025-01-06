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

        while (!stoppingToken.IsCancellationRequested) {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            Console.WriteLine("Checking for items to download...");
            
            foreach (var queueItem in dbContext.DownloadQueueItems) {
                try {
                    Console.WriteLine($"Downloading {queueItem.Url}");
                    var downloadHandler = DownloadHandlerRegistry.GetDownloadHandlerForUrl(queueItem.Url);

                    var saveResults =
                        downloadHandler != null ? 
                            await downloadHandler.Download(queueItem.Url, shareLocation, maxThreads) :
                            new IDownloadHandler.DownloadResult(false, $"No handler found for {queueItem.Url}");
                    
                    Console.WriteLine(saveResults.Message);

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
                    Console.WriteLine(e);
                    await NotificationHelper.SendNotification("Error Downloading", e.Message, "x");
                    // Save anything that succeeded
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }
}