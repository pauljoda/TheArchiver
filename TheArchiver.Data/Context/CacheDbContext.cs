using Microsoft.EntityFrameworkCore;
using TheArchiver.Data.Models;

namespace TheArchiver.Data.Context;

public class CacheDbContext(DbContextOptions options) : DbContext(options) {
    public DbSet<DownloadQueueItem> DownloadQueueItems => Set<DownloadQueueItem>();
    public DbSet<FailedDownloads> FailedDownloads => Set<FailedDownloads>();
}