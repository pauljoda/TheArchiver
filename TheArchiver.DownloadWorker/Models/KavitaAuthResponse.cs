using System.Text.Json.Serialization;

namespace TheArchiver.DownloadWorker.Models;

// Kavita Auth Response
public class KavitaAuthResponse {
    [JsonPropertyName("username")] public string Username { get; set; }

    [JsonPropertyName("email")] public string Email { get; set; }

    [JsonPropertyName("token")] public string Token { get; set; }

    [JsonPropertyName("refreshToken")] public string RefreshToken { get; set; }

    [JsonPropertyName("apiKey")] public string ApiKey { get; set; }

    [JsonPropertyName("preferences")] public object Preferences { get; set; }

    [JsonPropertyName("ageRestriction")] public object AgeRestriction { get; set; }

    [JsonPropertyName("kavitaVersion")] public string KavitaVersion { get; set; }
}