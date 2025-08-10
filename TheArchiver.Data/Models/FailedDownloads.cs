namespace TheArchiver.Data.Models;

using System.ComponentModel.DataAnnotations;

public class FailedDownloads {
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string Url { get; set; } = string.Empty;
    
    [Required]
    public string ErrorMessage { get; set; } = string.Empty;
}
