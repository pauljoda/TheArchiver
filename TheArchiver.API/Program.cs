using Data.Context;
using TheArchiver.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.AddSqlServerDbContext<CacheDbContext>("download-cache");

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "API v1"));
}

#region API Endpoints

// Health Check
app.MapGet("api/health", () => "Healthy");

// Test
app.MapPost("/test", async (CacheDbContext dbContext) => {
    var item = new Data.Models.DownloadQueueItem {
        Url = "https://manga.com/manga/1"
    };
    dbContext.DownloadQueueItems.Add(item);
    await dbContext.SaveChangesAsync();
    return item;
});

// Add to queue
app.MapPost("/api/download", async (CacheDbContext dbContext, string url) => {
    var item = new Data.Models.DownloadQueueItem {
        Url = url
    };
    Console.WriteLine($"Caching download of {url}");
    dbContext.DownloadQueueItems.Add(item);
    await dbContext.SaveChangesAsync();
});

#endregion

app.Run();