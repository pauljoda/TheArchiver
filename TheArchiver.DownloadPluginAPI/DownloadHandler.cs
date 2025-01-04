namespace TheArhiver.DownloadPluginAPI;

[AttributeUsage(AttributeTargets.Class)]
public class DownloadHandler(string baseUrl) : Attribute {
    /// <summary>
    /// Gets or sets the base URL associated with the download handler.
    /// This property is used to identify the appropriate handler for specific base URLs
    /// provided in downloaded content. It is intended to map a certain URL scheme or domain
    /// to its corresponding download logic.
    /// </summary>
    public string BaseUrl { get; set; } = baseUrl;
}