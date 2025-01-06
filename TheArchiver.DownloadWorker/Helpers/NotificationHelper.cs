using System.Text;

namespace TheArchiver.DownloadWorker.Helpers;

public static class NotificationHelper {
    
    /// <summary>
    /// Sends a notification containing the specified message to the configured notification endpoint.
    /// </summary>
    /// <param name="title">Notification title</param>
    /// <param name="message">The message to be sent in the notification.</param>
    /// <param name="tags">https://notify.pauljoda.com/docs/publish/#tags-emojis command separated</param>
    /// <returns>A task that represents the asynchronous notification operation.</returns>
    public static async Task<bool> SendNotification(string title, string message, string tags = "") {
        var endpoint = Environment.GetEnvironmentVariable("NotificationUrl");
        if(string.IsNullOrEmpty(endpoint)) return false;
        
        var client = new HttpClient();
        var content = new StringContent(message, Encoding.UTF8, "text/plain");
        content.Headers.Add("Title", title);
        if(tags.Length > 0) content.Headers.Add("Tags", tags); // https://notify.pauljoda.com/docs/publish/#tags-emojis (command separated)

        var response = await client.PostAsync(endpoint, content);
        return response.IsSuccessStatusCode;
    }
}