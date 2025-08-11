using TheArchiver.Data.Context;
using TheArchiver.DownloadWorker;
using TheArchiver.DownloadWorker.Helpers;
using TheArchiver.ServiceDefaults;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<Worker>();
builder.AddServiceDefaults();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Worker.ActivitySourceName));

builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

DownloadHandlerRegistry.Init(Environment.GetEnvironmentVariable("PluginsLocation") ?? "./Plugins");

var host = builder.Build();

// Removed legacy ConsoleOutputService initialization (worker logs are scraped from container logs)

host.Run();