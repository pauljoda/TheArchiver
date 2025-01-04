namespace TheArchiver.Data.Models;

public class FailedDownloads {
    public int Id { get; set; }
    public string Url { get; set; }
    public string ErrorMessage { get; set; }
}
