namespace TheArhiver.DownloadPluginAPI;

public interface IDownloadHandler {
    /// <summary>
    /// Download the content at the provided url
    /// </summary>
    /// <param name="url">The URL of the source to download</param>
    /// <param name="rootDirectory">The root of where things should be downloaded, it is
    ///     best practice to put into a sub directory, such as "Manga" or "Videos" etc</param>
    /// <param name="maxDownloadThreads">Max threads to use</param>
    /// <returns>String true if successful</returns>
    Task<DownloadResult> Download(string url, string rootDirectory, int maxDownloadThreads);

    /// <summary>
    /// Represents the result of a download operation.
    /// </summary>
    public record DownloadResult(bool Success, string Message);
}