using Microsoft.AspNetCore.SignalR;
using TheArchiver.Monitor.Hubs;
using System.Collections.Concurrent;

namespace TheArchiver.Monitor.Services;

public interface IConsoleOutputService
{
    Task SendConsoleOutputAsync(string level, string source, string message);
    Task SendDebugAsync(string source, string message);
    Task SendInformationAsync(string source, string message);
    Task SendWarningAsync(string source, string message);
    Task SendErrorAsync(string source, string message);
    Task SendCriticalAsync(string source, string message);
    Task<bool> IsHealthyAsync();
    Task<IEnumerable<ConsoleOutputMessage>> GetRecentMessagesAsync(int count = 100);
}

public class ConsoleOutputService : IConsoleOutputService
{
    private readonly IHubContext<ConsoleHub> _hubContext;
    private readonly ILogger<ConsoleOutputService> _logger;
    private readonly ConcurrentQueue<ConsoleOutputMessage> _messageBuffer = new();
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private readonly int _maxBufferSize = 1000;
    private readonly TimeSpan _retryDelay = TimeSpan.FromSeconds(1);
    private readonly int _maxRetries = 3;

    public ConsoleOutputService(IHubContext<ConsoleHub> hubContext, ILogger<ConsoleOutputService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task SendConsoleOutputAsync(string level, string source, string message)
    {
        var consoleMessage = new ConsoleOutputMessage
        {
            Level = level,
            Source = source,
            Message = message,
            Timestamp = DateTime.UtcNow
        };

        // Add to buffer for potential replay
        AddToBuffer(consoleMessage);

        try
        {
            await SendWithRetryAsync(consoleMessage);
            _logger.LogDebug("Console output sent successfully: {Level} from {Source}: {Message}", level, source, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send console output after retries: {Level} from {Source}: {Message}", level, source, message);
            
            // Even if SignalR fails, we still log locally
            _logger.LogInformation("[{Level}] [{Source}] {Message}", level, source, message);
        }
    }

    private async Task SendWithRetryAsync(ConsoleOutputMessage message)
    {
        for (int attempt = 1; attempt <= _maxRetries; attempt++)
        {
            try
            {
                await _hubContext.Clients.All.SendAsync("ConsoleOutput", message.Level, message.Source, message.Message);
                return; // Success, exit retry loop
            }
            catch (Exception ex) when (attempt < _maxRetries)
            {
                _logger.LogWarning(ex, "Attempt {Attempt} failed to send console output, retrying in {Delay}ms", 
                    attempt, _retryDelay.TotalMilliseconds);
                await Task.Delay(_retryDelay);
            }
        }

        // If we get here, all retries failed
        throw new InvalidOperationException($"Failed to send console output after {_maxRetries} attempts");
    }

    private void AddToBuffer(ConsoleOutputMessage message)
    {
        _messageBuffer.Enqueue(message);
        
        // Keep buffer size manageable
        while (_messageBuffer.Count > _maxBufferSize)
        {
            _messageBuffer.TryDequeue(out _);
        }
    }

    public async Task SendDebugAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Debug", source, message);
    }

    public async Task SendInformationAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Information", source, message);
    }

    public async Task SendWarningAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Warning", source, message);
    }

    public async Task SendErrorAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Error", source, message);
    }

    public async Task SendCriticalAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Critical", source, message);
    }

    public async Task<bool> IsHealthyAsync()
    {
        try
        {
            // Simple health check - try to send a test message
            await _hubContext.Clients.All.SendAsync("HealthCheck", "Health", "Service", "Health check");
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IEnumerable<ConsoleOutputMessage>> GetRecentMessagesAsync(int count = 100)
    {
        await _semaphore.WaitAsync();
        try
        {
            return _messageBuffer.TakeLast(count).ToList();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task ClearBufferAsync()
    {
        await _semaphore.WaitAsync();
        try
        {
            while (_messageBuffer.TryDequeue(out _)) { }
        }
        finally
        {
            _semaphore.Release();
        }
    }
}

public class ConsoleOutputMessage
{
    public string Level { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
