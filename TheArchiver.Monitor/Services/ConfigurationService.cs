using Microsoft.Extensions.Options;

namespace TheArchiver.Monitor.Services;

public class MonitorConfiguration
{
    public const string SectionName = "Monitor";
    
    public int MaxConsoleLines { get; set; } = 1000;
    public int MaxBufferSize { get; set; } = 1000;
    public int RetryDelaySeconds { get; set; } = 2;
    public int MaxRetries { get; set; } = 3;
    public int CircuitBreakerTimeoutMinutes { get; set; } = 1;
    public int MessageQueueProcessorIntervalSeconds { get; set; } = 5;
    public bool EnableDetailedLogging { get; set; } = false;
    public string[] AllowedOrigins { get; set; } = { "http://localhost:5000", "https://localhost:5001" };
}

public interface IConfigurationService
{
    MonitorConfiguration Configuration { get; }
    T GetValue<T>(string key, T defaultValue = default!);
    string GetConnectionString(string name);
}

public class ConfigurationService : IConfigurationService
{
    private readonly MonitorConfiguration _configuration;
    private readonly IConfiguration _configurationRoot;

    public ConfigurationService(IOptions<MonitorConfiguration> configuration, IConfiguration configurationRoot)
    {
        _configuration = configuration.Value;
        _configurationRoot = configurationRoot;
    }

    public MonitorConfiguration Configuration => _configuration;

    public T GetValue<T>(string key, T defaultValue = default!)
    {
        return _configurationRoot.GetValue(key, defaultValue) ?? defaultValue;
    }

    public string GetConnectionString(string name)
    {
        return _configurationRoot.GetConnectionString(name) ?? string.Empty;
    }
}
