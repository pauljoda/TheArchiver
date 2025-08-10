# TheArchiver Monitor

A modern, real-time monitoring application for TheArchiver download operations with advanced console output streaming and health monitoring capabilities.

## Features

### 🚀 Real-Time Console Output
- **Live Streaming**: Real-time console output from DownloadWorker processes
- **SignalR Integration**: WebSocket-based communication for instant updates
- **Message Buffering**: Intelligent message queuing with retry logic
- **Circuit Breaker Pattern**: Automatic fallback when monitor is unavailable

### 📊 Advanced Monitoring
- **Health Checks**: Comprehensive system health monitoring
- **Performance Metrics**: Memory usage, uptime, and connection tracking
- **Client Management**: Real-time client connection monitoring
- **Error Tracking**: Detailed error logging and notification system

### 🔧 Modern Architecture
- **RESTful API**: Clean, documented API endpoints
- **Dependency Injection**: Proper service registration and lifecycle management
- **Configuration Management**: Centralized configuration with validation
- **Error Handling**: Robust error handling with graceful degradation

## Architecture

### Components

```
┌─────────────────┐    HTTP POST    ┌─────────────────┐    SignalR    ┌─────────────────┐
│ DownloadWorker  │ ──────────────► │ Monitor API     │ ────────────► │ Web Browser     │
│                 │                 │                 │               │                 │
│ ConsoleOutput   │                 │ ConsoleHub      │               │ ConsoleOutput   │
│ Service         │                 │                 │               │ Component       │
└─────────────────┘                 └─────────────────┘               └─────────────────┘
```

### SignalR Hub Methods

#### Client → Server
- `SendConsoleOutput(level, source, message)` - Send console output
- `JoinConsoleGroup(groupName)` - Join a console group
- `LeaveConsoleGroup(groupName)` - Leave a console group
- `GetConnectionInfo()` - Get connection information
- `Ping()` - Send ping request
- `GetHealthStatus()` - Get health status

#### Server → Client
- `ConsoleOutput(level, source, message)` - Receive console output
- `ConnectionEstablished(connectionId)` - Connection confirmation
- `Error(message)` - Error messages
- `GroupJoined(groupName)` - Group join confirmation
- `GroupLeft(groupName)` - Group leave confirmation
- `ConnectionInfo(info)` - Connection information
- `Pong(timestamp)` - Ping response
- `HealthStatus(status)` - Health status update

## API Endpoints

### Console Output
- `POST /api/console` - Send console output
- `GET /api/console/health` - Console service health

### Health Monitoring
- `GET /api/health` - System health status
- `GET /api/health/console` - Console service health
- `GET /api/health/clients` - Connected clients information

## Configuration

### appsettings.json
```json
{
  "Monitor": {
    "MaxConsoleLines": 1000,
    "MaxBufferSize": 1000,
    "RetryDelaySeconds": 2,
    "MaxRetries": 3,
    "CircuitBreakerTimeoutMinutes": 1,
    "MessageQueueProcessorIntervalSeconds": 5,
    "EnableDetailedLogging": true,
    "AllowedOrigins": [
      "http://localhost:5000",
      "https://localhost:5001"
    ]
  }
}
```

### Environment Variables
- `MonitorUrl` - URL of the monitor service (set in DownloadWorker)

## Getting Started

### Prerequisites
- .NET 8.0 or later
- SQL Server (for database operations)
- Modern web browser with WebSocket support

### Running the Monitor
1. Navigate to the Monitor project directory
2. Run `dotnet run`
3. Open `http://localhost:5000` in your browser
4. Navigate to the Console Output page

### Running the DownloadWorker
1. Set the `MonitorUrl` environment variable
2. Run the DownloadWorker project
3. Console output will automatically stream to the Monitor

## Development

### Project Structure
```
TheArchiver.Monitor/
├── Controllers/          # API controllers
├── Hubs/                # SignalR hubs
├── Services/            # Business logic services
├── Models/              # Data models
├── Components/          # Blazor components
├── Pages/               # Blazor pages
└── wwwroot/            # Static assets
```

### Key Services
- `IConsoleOutputService` - Console output management
- `IConfigurationService` - Configuration management
- `QueueMonitorService` - Download queue monitoring
- `NotificationService` - User notifications

### Adding New Features
1. Create models in the `Models/` directory
2. Add services in the `Services/` directory
3. Create controllers in the `Controllers/` directory
4. Update the UI components as needed
5. Add configuration options if required

## Performance Considerations

### Message Buffering
- Messages are buffered in memory with configurable limits
- Automatic cleanup prevents memory leaks
- Circuit breaker pattern prevents cascading failures

### SignalR Optimization
- Automatic reconnection with exponential backoff
- Connection pooling and management
- Efficient message broadcasting

### Database Operations
- Minimal database queries
- Efficient connection management
- Proper disposal of resources

## Security

### Current State
- No authentication required (development setup)
- CORS configuration for local development
- Input validation on all endpoints

### Production Considerations
- Implement proper authentication
- Add rate limiting
- Configure HTTPS
- Implement audit logging
- Add input sanitization

## Troubleshooting

### Common Issues

#### Console Output Not Appearing
1. Check `MonitorUrl` environment variable
2. Verify monitor service is running
3. Check browser console for errors
4. Verify SignalR connection status

#### Connection Issues
1. Check network connectivity
2. Verify firewall settings
3. Check CORS configuration
4. Review SignalR hub configuration

#### Performance Issues
1. Monitor memory usage
2. Check message buffer size
3. Review retry configuration
4. Monitor database performance

### Debug Mode
Enable detailed logging by setting `EnableDetailedLogging: true` in configuration.

## Contributing

1. Follow the existing code structure
2. Add appropriate error handling
3. Include unit tests for new features
4. Update documentation
5. Follow C# coding conventions

## License

This project is part of TheArchiver solution. See the main solution license for details.
