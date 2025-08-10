# TheArchiver Monitor API Documentation

## Overview
The TheArchiver Monitor provides a REST API for console output streaming and system health monitoring, along with real-time SignalR communication.

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently, no authentication is required for these endpoints.

## Console Output API

### POST /api/console
Sends console output to be broadcast to all connected SignalR clients.

**Request Body:**
```json
{
  "level": "Information",
  "source": "Worker",
  "message": "Download completed successfully",
  "timestamp": "2024-01-03T16:40:17Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Console output broadcast successfully"
}
```

**Status Codes:**
- `200 OK` - Console output broadcast successfully
- `400 Bad Request` - Invalid request format
- `500 Internal Server Error` - Server error

### GET /api/console/health
Health check endpoint for the console service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-03T16:40:17Z"
}
```

## Health API

### GET /api/health
Comprehensive health status of the entire system.

**Response:**
```json
{
  "status": "Healthy",
  "timestamp": "2024-01-03T16:40:17Z",
  "services": {
    "consoleOutput": "Healthy",
    "signalR": "Healthy",
    "database": "Healthy"
  },
  "metrics": {
    "connectedClients": 2,
    "uptime": "00:15:30",
    "memoryUsage": {
      "workingSetMB": 45.2,
      "privateMemoryMB": 32.1,
      "virtualMemoryMB": 128.5
    }
  },
  "connectedClients": [
    {
      "connectionId": "abc123",
      "connectedAt": "2024-01-03T16:25:00Z",
      "duration": "00:15:17",
      "ipAddress": "127.0.0.1"
    }
  ]
}
```

### GET /api/health/console
Console service specific health check.

**Response:**
```json
{
  "isHealthy": true,
  "connectedClients": 2,
  "timestamp": "2024-01-03T16:40:17Z"
}
```

### GET /api/health/clients
Information about currently connected SignalR clients.

**Response:**
```json
{
  "totalClients": 2,
  "clients": [
    {
      "connectionId": "abc123",
      "connectedAt": "2024-01-03T16:25:00Z",
      "duration": "00:15:17",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "timestamp": "2024-01-03T16:40:17Z"
}
```

## SignalR Hubs

### ConsoleHub
**Endpoint:** `/consolehub`

**Client Methods:**
- `ConsoleOutput(level, source, message)` - Receives console output
- `ConnectionEstablished(connectionId)` - Connection confirmation
- `Error(message)` - Error messages
- `GroupJoined(groupName)` - Group join confirmation
- `GroupLeft(groupName)` - Group leave confirmation
- `ConnectionInfo(info)` - Connection information
- `Pong(timestamp)` - Ping response
- `HealthStatus(status)` - Health status update

**Server Methods:**
- `SendConsoleOutput(level, source, message)` - Send console output
- `JoinConsoleGroup(groupName)` - Join a console group
- `LeaveConsoleGroup(groupName)` - Leave a console group
- `GetConnectionInfo()` - Get connection information
- `Ping()` - Send ping
- `GetHealthStatus()` - Get health status

## Error Handling

All endpoints return appropriate HTTP status codes and error messages in JSON format:

```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-03T16:40:17Z"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## Monitoring and Metrics

The API provides several metrics:
- Connected client count
- System uptime
- Memory usage
- Service health status
- Connection duration tracking

## Best Practices

1. **Error Handling**: Always check HTTP status codes and handle errors gracefully
2. **Retry Logic**: Implement exponential backoff for failed requests
3. **Connection Management**: Properly manage SignalR connections with reconnection logic
4. **Health Checks**: Regularly poll health endpoints to monitor system status
5. **Logging**: Log all API interactions for debugging and monitoring

## Example Usage

### C# HttpClient Example
```csharp
using var client = new HttpClient();
var consoleMessage = new
{
    Level = "Information",
    Source = "Worker",
    Message = "Download started",
    Timestamp = DateTime.UtcNow
};

var json = JsonSerializer.Serialize(consoleMessage);
var content = new StringContent(json, Encoding.UTF8, "application/json");

var response = await client.PostAsync("http://localhost:5000/api/console", content);
if (response.IsSuccessStatusCode)
{
    Console.WriteLine("Console output sent successfully");
}
```

### JavaScript SignalR Example
```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/consolehub")
    .withAutomaticReconnect()
    .build();

connection.on("ConsoleOutput", (level, source, message) => {
    console.log(`[${level}] [${source}] ${message}`);
});

connection.start()
    .then(() => console.log("Connected to console hub"))
    .catch(err => console.error("Connection failed:", err));
```
