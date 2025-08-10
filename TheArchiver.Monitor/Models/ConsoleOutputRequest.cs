namespace TheArchiver.Monitor.Models;

public class ConsoleOutputRequest
{
    public string? Level { get; set; }
    public string? Source { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime? Timestamp { get; set; }
}
