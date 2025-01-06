var builder = DistributedApplication.CreateBuilder(args);

// Set static password for between run instances
var password = builder.AddParameter("sql-password", secret: true);

// SQL Cache Server
var sql = builder.AddSqlServer("sql", password)
    .WithDataVolume(name: "download-cache-data")
    .AddDatabase("download-cache");

// DB Migrations
var migrations = builder.AddProject<Projects.TheArchiver_MigrationService>("migrations")
    .WithReference(sql)
    .WaitFor(sql);

// Web TheArchiver.API
var api = builder.AddProject<Projects.TheArchiver_API>("api")
    .WithReference(sql)
    .WaitFor(sql);

// Background Task
var backgroundTask = builder.AddProject<Projects.TheArchiver_DownloadWorker>("background-download")
    .WithEnvironment("MaxConcurrentThreads", builder.Configuration["MaxConcurrentThreads"])
    .WithEnvironment("ShareLocation", builder.Configuration["ShareLocation"])
    .WithEnvironment("PluginsLocation", builder.Configuration["PluginsLocation"])
    .WithEnvironment("NotificationUrl", builder.Configuration["NotificationUrl"])
    .WithReference(sql)
    .WaitFor(migrations);

builder.Build().Run();