namespace TheArchiver.Data.Models;

using System.ComponentModel.DataAnnotations;

public class DownloadQueueItem {
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string Url { get; set; } = string.Empty;
}
