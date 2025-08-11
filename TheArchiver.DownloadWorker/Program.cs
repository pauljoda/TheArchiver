using TheArchiver.Data.Context;
using TheArchiver.DownloadWorker;
using TheArchiver.DownloadWorker.Helpers;
using TheArchiver.DownloadWorker.Models;
using TheArchiver.ServiceDefaults;
using DownloadPluginAPI.Helpers;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<Worker>();
builder.AddServiceDefaults();

// Configure Kavita settings
builder.Services.Configure<KavitaConfiguration>(
    builder.Configuration.GetSection("Kavita"));

// Register KavitaHelper as a service
builder.Services.AddScoped<KavitaHelper>();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Worker.ActivitySourceName));

builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

DownloadHandlerRegistry.Init(Environment.GetEnvironmentVariable("PluginsLocation") ?? "./Plugins");

var host = builder.Build();

// Removed legacy ConsoleOutputService initialization (worker logs are scraped from container logs)

host.Run();