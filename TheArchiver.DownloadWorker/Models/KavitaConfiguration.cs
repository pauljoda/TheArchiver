namespace TheArchiver.DownloadWorker.Models;

public class KavitaConfiguration
{
    public string BaseUrl { get; set; } = "https://kavita.pauljoda.com";
    public string ApiKey { get; set; } = "0e77b1d9-d0a6-45ce-a7bf-297d81ba3d7a";
    public string PluginName { get; set; } = "Downloader";
    public string LibraryId { get; set; } = "5";
    public bool ForceLibraryScan { get; set; } = false;
    public int ScanDelayMilliseconds { get; set; } = 15000;
}
