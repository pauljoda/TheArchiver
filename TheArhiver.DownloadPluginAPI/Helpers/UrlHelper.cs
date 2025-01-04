namespace TheArhiver.DownloadPluginAPI.Helpers;

public static class UrlHelper {
    /// <summary>
    /// Extracts the base URL (scheme and host) from a given full URL.
    /// </summary>
    /// <param name="url">The full URL string to extract the base URL from.</param>
    /// <returns>The base URL as a string, consisting of the scheme and host.</returns>
    /// <exception cref="ArgumentException">Thrown when the provided URL is null, empty, or contains only whitespace.</exception>
    /// <exception cref="FormatException">Thrown when the provided URL is not in a valid format.</exception>
    public static string ExtractBaseUrl(string url) {
        if (string.IsNullOrWhiteSpace(url)) {
            throw new ArgumentException("URL cannot be null or empty", nameof(url));
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out var uri)) {
            return $"{uri.Scheme}://{uri.Host}";
        }

        throw new FormatException("Invalid URL format");
    }
}