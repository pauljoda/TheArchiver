using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace TheArchiver.DownloadWorker.Helpers;

public static class ConsoleOutputService
{
    private static readonly HttpClient _httpClient;
    private static readonly ILogger? _logger = CreateLogger();
    private static IServiceProvider? _serviceProvider;
    private static readonly SemaphoreSlim _semaphore = new(1, 1);
    private static readonly Queue<ConsoleMessage> _messageQueue = new();
    private static readonly int _maxQueueSize = 1000;
    private static readonly TimeSpan _retryDelay = TimeSpan.FromSeconds(2);
    private static readonly int _maxRetries = 3;
    private static bool _isCircuitOpen = false;
    private static DateTime _circuitOpenTime = DateTime.MinValue;
    private static readonly TimeSpan _circuitBreakerTimeout = TimeSpan.FromMinutes(1);
    
    static ConsoleOutputService()
    {
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        
        // Start background processor
        _ = Task.Run(ProcessMessageQueueAsync);
    }

    public static void Initialize(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }
    
    public static async Task SendConsoleOutputAsync(string level, string source, string message)
    {
        var consoleMessage = new ConsoleMessage
        {
            Level = level,
            Source = source,
            Message = message,
            Timestamp = DateTime.UtcNow
        };

        // Always log to console first
        LogToConsole(level, source, message);
        
        // If service provider is not configured, just return
        if (_serviceProvider == null)
        {
            return;
        }

        // Check circuit breaker
        if (_isCircuitOpen)
        {
            if (DateTime.UtcNow - _circuitOpenTime > _circuitBreakerTimeout)
            {
                _isCircuitOpen = false;
                _logger?.LogInformation("Circuit breaker reset, resuming monitor communication");
            }
            else
            {
                // Circuit is open, queue message for later
                QueueMessage(consoleMessage);
                return;
            }
        }

        try
        {
            await SendWithRetryAsync(consoleMessage);
            _logger?.LogDebug("Console output sent to monitor successfully: {Level} from {Source}", level, source);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to send console output to monitor, queuing for retry: {Level} from {Source}", level, source);
            
            // Queue message for retry
            QueueMessage(consoleMessage);
            
            // Open circuit breaker if we're having persistent issues
            if (!_isCircuitOpen)
            {
                _isCircuitOpen = true;
                _circuitOpenTime = DateTime.UtcNow;
                _logger?.LogWarning("Circuit breaker opened due to persistent failures");
            }
        }
    }

    private static async Task SendWithRetryAsync(ConsoleMessage message)
    {
        for (int attempt = 1; attempt <= _maxRetries; attempt++)
        {
            try
            {
                var json = JsonSerializer.Serialize(message);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Use service discovery to get monitor URL
                using var scope = _serviceProvider?.CreateScope();
                var httpClientFactory = scope?.ServiceProvider.GetService<IHttpClientFactory>();
                
                using var client = httpClientFactory?.CreateClient() ?? _httpClient;
                var response = await client.PostAsync("https://monitor/api/console", content);
                
                if (response.IsSuccessStatusCode)
                {
                    return; // Success
                }
                
                // Log non-success status codes
                var responseContent = await response.Content.ReadAsStringAsync();
                _logger?.LogWarning("Monitor API returned {StatusCode}: {Response}", response.StatusCode, responseContent);
                
                if (attempt == _maxRetries)
                {
                    throw new HttpRequestException($"Monitor API returned {response.StatusCode}: {responseContent}");
                }
            }
            catch (Exception ex) when (attempt < _maxRetries)
            {
                _logger?.LogDebug(ex, "Attempt {Attempt} failed, retrying in {Delay}ms", attempt, _retryDelay.TotalMilliseconds);
                await Task.Delay(_retryDelay);
            }
        }
        
        throw new InvalidOperationException($"Failed to send console output after {_maxRetries} attempts");
    }

    private static void QueueMessage(ConsoleMessage message)
    {
        try
        {
            _semaphore.Wait();
            
            if (_messageQueue.Count >= _maxQueueSize)
            {
                _messageQueue.Dequeue(); // Remove oldest message
            }
            
            _messageQueue.Enqueue(message);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private static async Task ProcessMessageQueueAsync()
    {
        while (true)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5)); // Process every 5 seconds
                
                if (_messageQueue.Count == 0 || _isCircuitOpen)
                {
                    continue;
                }

                var messagesToProcess = new List<ConsoleMessage>();
                
                // Get messages from queue
                await _semaphore.WaitAsync();
                try
                {
                    while (_messageQueue.Count > 0)
                    {
                        messagesToProcess.Add(_messageQueue.Dequeue());
                    }
                }
                finally
                {
                    _semaphore.Release();
                }

                // Process messages
                foreach (var message in messagesToProcess)
                {
                    try
                    {
                        await SendWithRetryAsync(message);
                        _logger?.LogDebug("Queued message sent successfully: {Level} from {Source}", message.Level, message.Source);
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Failed to send queued message, re-queuing: {Level} from {Source}", message.Level, message.Source);
                        
                        // Re-queue the message
                        QueueMessage(message);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error in message queue processor");
            }
        }
    }

    private static void LogToConsole(string level, string source, string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        var logMessage = $"[{timestamp}] [{level.ToUpper()}] [{source}] {message}";
        
        var color = level.ToLower() switch
        {
            "error" or "critical" => ConsoleColor.Red,
            "warning" => ConsoleColor.Yellow,
            "information" => ConsoleColor.Blue,
            "debug" => ConsoleColor.Gray,
            _ => ConsoleColor.White
        };
        
        var originalColor = Console.ForegroundColor;
        Console.ForegroundColor = color;
        Console.WriteLine(logMessage);
        Console.ForegroundColor = originalColor;
    }

    public static async Task SendDebugAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Debug", source, message);
    }

    public static async Task SendInformationAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Information", source, message);
    }

    public static async Task SendWarningAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Warning", source, message);
    }

    public static async Task SendErrorAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Error", source, message);
    }

    public static async Task SendCriticalAsync(string source, string message)
    {
        await SendConsoleOutputAsync("Critical", source, message);
    }

    public static async Task<bool> TestMonitorConnectionAsync()
    {
        if (_serviceProvider == null)
        {
            return false;
        }

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var httpClientFactory = scope.ServiceProvider.GetService<IHttpClientFactory>();
            
            using var client = httpClientFactory?.CreateClient() ?? _httpClient;
            var response = await client.GetAsync("https://monitor/api/console/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public static void Dispose()
    {
        _httpClient?.Dispose();
        _semaphore?.Dispose();
    }

    private static ILogger? CreateLogger()
    {
        try
        {
            // Simple console logger for the static class
            using var loggerFactory = LoggerFactory.Create(builder =>
            {
                builder.AddConsole();
                builder.SetMinimumLevel(LogLevel.Debug);
            });
            return loggerFactory.CreateLogger("ConsoleOutputService");
        }
        catch
        {
            return null;
        }
    }
}

public class ConsoleMessage
{
    public string Level { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
