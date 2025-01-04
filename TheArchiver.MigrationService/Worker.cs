using System.Diagnostics;
using TheArchiver.Data.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using OpenTelemetry.Trace;

namespace TheArchiver.MigrationService;

public class Worker(
    IServiceProvider serviceProvider,
    IHostApplicationLifetime hostApplicationLifetime) : BackgroundService {
    
    public const string ActivitySourceName = "Migrations";
    private static readonly ActivitySource SActivitySource = new(ActivitySourceName);
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        using var activity = SActivitySource.StartActivity("Migrating database", ActivityKind.Client);

        try {
            using var scope = serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<CacheDbContext>();

            await EnsureDatabaseAsync(dbContext, stoppingToken);
            await RunMigrationAsync(dbContext, stoppingToken);
        }
        catch (Exception ex) {
            activity?.RecordException(ex);
            throw;
        }

        hostApplicationLifetime.StopApplication();
    }

    private static async Task EnsureDatabaseAsync(CacheDbContext dbContext, CancellationToken cancellationToken) {
        var dbCreator = dbContext.GetService<IRelationalDatabaseCreator>();

        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () => {
            // Create the database if it does not exist.
            // Do this first so there is then a database to start a transaction against.
            if (!await dbCreator.ExistsAsync(cancellationToken)) {
                await dbCreator.CreateAsync(cancellationToken);
            }
        });
    }

    private static async Task RunMigrationAsync(CacheDbContext dbContext, CancellationToken cancellationToken) {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () => {
            await dbContext.Database.MigrateAsync(cancellationToken);
        });
    }
}