using Microsoft.AspNetCore.Mvc;
using TheArchiver.Monitor.Services;
using TheArchiver.Monitor.Models;

namespace TheArchiver.Monitor.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConsoleController : ControllerBase
{
    private readonly IConsoleOutputService _consoleOutputService;
    private readonly ILogger<ConsoleController> _logger;

    public ConsoleController(IConsoleOutputService consoleOutputService, ILogger<ConsoleController> logger)
    {
        _consoleOutputService = consoleOutputService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> PostConsoleOutput([FromBody] ConsoleOutputRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Message))
            {
                return BadRequest("Invalid console output request");
            }

            await _consoleOutputService.SendConsoleOutputAsync(
                request.Level ?? "Information",
                request.Source ?? "Unknown",
                request.Message
            );

            _logger.LogDebug("Console output received and broadcast: {Level} from {Source}: {Message}", 
                request.Level, request.Source, request.Message);

            return Ok(new { success = true, message = "Console output broadcast successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process console output request");
            return StatusCode(500, new { success = false, message = "Internal server error" });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
}
