using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using TheArchiver.Data.Context;

namespace TheArchiver.Monitor.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ILogger<HealthController> _logger;
    private readonly CacheDbContext _dbContext;

    public HealthController(ILogger<HealthController> logger, CacheDbContext dbContext)
    {
        _logger = logger;
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            bool databaseHealthy;
            try
            {
                databaseHealthy = await _dbContext.Database.CanConnectAsync();
            }
            catch (Exception)
            {
                databaseHealthy = false;
            }

            var healthStatus = new
            {
                Status = databaseHealthy ? "Healthy" : "Degraded",
                Timestamp = DateTime.UtcNow,
                Services = new
                {
                    Database = databaseHealthy ? "Healthy" : "Unhealthy"
                },
                Metrics = new
                {
                    Uptime = GetUptime(),
                    MemoryUsage = GetMemoryUsage()
                }
            };

            return Ok(healthStatus);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return StatusCode(500, new
            {
                Status = "Unhealthy",
                Timestamp = DateTime.UtcNow,
                Error = ex.Message
            });
        }
    }

    private static TimeSpan GetUptime()
    {
        try
        {
            return DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime();
        }
        catch
        {
            return TimeSpan.Zero;
        }
    }

    private static object GetMemoryUsage()
    {
        try
        {
            var process = Process.GetCurrentProcess();
            return new
            {
                WorkingSet = process.WorkingSet64,
                WorkingSetMB = Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 2),
                PrivateMemory = process.PrivateMemorySize64,
                PrivateMemoryMB = Math.Round(process.PrivateMemorySize64 / 1024.0 / 1024.0, 2),
                VirtualMemory = process.VirtualMemorySize64,
                VirtualMemoryMB = Math.Round(process.VirtualMemorySize64 / 1024.0 / 1024.0, 2)
            };
        }
        catch
        {
            return new { Error = "Unable to retrieve memory information" };
        }
    }
}
