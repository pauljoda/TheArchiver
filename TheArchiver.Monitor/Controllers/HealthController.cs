using Microsoft.AspNetCore.Mvc;
using TheArchiver.Monitor.Hubs;
using TheArchiver.Monitor.Services;
using System.Diagnostics;

namespace TheArchiver.Monitor.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IConsoleOutputService _consoleOutputService;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IConsoleOutputService consoleOutputService, ILogger<HealthController> logger)
    {
        _consoleOutputService = consoleOutputService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealth()
    {
        try
        {
            var consoleHealth = await _consoleOutputService.IsHealthyAsync();
            var connectedClients = ConsoleHub.GetConnectedClientsCount();
            var connectedClientsInfo = ConsoleHub.GetConnectedClients();

            var healthStatus = new
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                Services = new
                {
                    ConsoleOutput = consoleHealth ? "Healthy" : "Unhealthy",
                    SignalR = "Healthy",
                    Database = "Healthy" // TODO: Add actual database health check
                },
                Metrics = new
                {
                    ConnectedClients = connectedClients,
                    Uptime = GetUptime(),
                    MemoryUsage = GetMemoryUsage()
                },
                ConnectedClients = connectedClientsInfo.Select(c => new
                {
                    ConnectionId = c.ConnectionId,
                    ConnectedAt = c.ConnectedAt,
                    Duration = DateTime.UtcNow - c.ConnectedAt,
                    IpAddress = c.IpAddress
                })
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

    [HttpGet("console")]
    public async Task<IActionResult> GetConsoleHealth()
    {
        try
        {
            var isHealthy = await _consoleOutputService.IsHealthyAsync();
            var connectedClients = ConsoleHub.GetConnectedClientsCount();

            return Ok(new
            {
                IsHealthy = isHealthy,
                ConnectedClients = connectedClients,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Console health check failed");
            return StatusCode(500, new
            {
                IsHealthy = false,
                Error = ex.Message,
                Timestamp = DateTime.UtcNow
            });
        }
    }

    [HttpGet("clients")]
    public IActionResult GetConnectedClients()
    {
        try
        {
            var clients = ConsoleHub.GetConnectedClients();
            
            return Ok(new
            {
                TotalClients = clients.Count(),
                Clients = clients.Select(c => new
                {
                    ConnectionId = c.ConnectionId,
                    ConnectedAt = c.ConnectedAt,
                    Duration = DateTime.UtcNow - c.ConnectedAt,
                    IpAddress = c.IpAddress,
                    UserAgent = c.UserAgent
                }),
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get connected clients");
            return StatusCode(500, new { Error = ex.Message });
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
