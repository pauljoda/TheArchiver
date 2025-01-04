using TheArchiver.Data.Context;
using TheArchiver.MigrationService;
using TheArchiver.ServiceDefaults;

var builder = Host.CreateApplicationBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddHostedService<Worker>();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(Worker.ActivitySourceName));

builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

var host = builder.Build();
host.Run();