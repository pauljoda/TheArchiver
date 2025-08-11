using TheArchiver.Data.Context;
using TheArchiver.ServiceDefaults;
using TheArchiver.Monitor.Services;
using Docker.DotNet;
using Docker.DotNet.Models;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddControllersWithViews();
builder.Services.AddHttpClient();

// Add database context
builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

// Add monitoring services
builder.Services.AddScoped<QueueMonitorService>();

// Add Docker client
builder.Services.AddSingleton<IDockerClient>(_ =>
{
    var dockerHost = Environment.GetEnvironmentVariable("DOCKER_HOST");
    if (!string.IsNullOrWhiteSpace(dockerHost))
    {
        return new DockerClientConfiguration(new Uri(dockerHost)).CreateClient();
    }

    if (OperatingSystem.IsWindows())
    {
        return new DockerClientConfiguration(new Uri("npipe://./pipe/docker_engine")).CreateClient();
    }

    // Default to local Unix socket (Linux/macOS)
    return new DockerClientConfiguration(new Uri("unix:///var/run/docker.sock")).CreateClient();
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseStaticFiles();
app.UseRouting();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapControllers();

app.Run();
