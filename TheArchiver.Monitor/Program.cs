using TheArchiver.Data.Context;
using TheArchiver.ServiceDefaults;
using TheArchiver.Monitor.Services;
using TheArchiver.Monitor.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
builder.Services.AddSignalR();
builder.Services.AddControllers();

// Add database context
builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

// Add monitoring services
builder.Services.AddScoped<QueueMonitorService>();
builder.Services.AddSingleton<NotificationService>();
builder.Services.AddSingleton<IConsoleOutputService, ConsoleOutputService>();

// Add configuration
builder.Services.Configure<MonitorConfiguration>(builder.Configuration.GetSection(MonitorConfiguration.SectionName));
builder.Services.AddSingleton<IConfigurationService, ConfigurationService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapBlazorHub();
app.MapHub<MonitorHub>("/monitorhub");
app.MapHub<ConsoleHub>("/consolehub");
app.MapControllers();
app.MapFallbackToPage("/_Host");

app.Run();
