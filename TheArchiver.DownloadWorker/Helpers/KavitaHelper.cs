using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using TheArchiver.DownloadWorker.Models;

namespace DownloadPluginAPI.Helpers;

public static class KavitaHelper {
    
    /// <summary>
    /// Sends a POST request to the Kavita TheArchiver.API to authenticate the plugin and retrieve a token.
    /// </summary>
    /// <returns>A string containing the authentication token if the request is successful, otherwise "Error".</returns>
    public static async Task<string> GetToken() {
        // Define the URL and TheArchiver.API parameters
        var url = "http://10.1.20.3:5000/api/Plugin/authenticate";
        var apiKey = "1ae5d06d-fbdc-4992-b805-5147419292f2";
        var pluginName = "Downloader";

        // Build the full URL with query parameters
        var fullUrl = $"{url}?apiKey={apiKey}&pluginName={pluginName}";

        // Create the HttpClient
        using (var client = new HttpClient()) {
            // Set headers
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("text/plain"));

            // Since the body is empty, we send a blank StringContent
            var content = new StringContent("", Encoding.UTF8, "application/x-www-form-urlencoded");

            try {
                // Make the POST request
                var response = await client.PostAsync(fullUrl, content);

                // Ensure the response status is successful
                response.EnsureSuccessStatusCode();

                // Read and display the response
                var responseBody = await response.Content.ReadAsStringAsync();
                Console.WriteLine("Obtained new Token");
                // Parse the JSON response and extract the token
                var jsonResponse = JsonSerializer.Deserialize<KavitaAuthResponse>(responseBody);
                return jsonResponse != null ? jsonResponse.Token : "Error";
            }
            catch (HttpRequestException ex) {
                Console.WriteLine($"Request error: {ex.Message}");
                return "Error";
            }
        }
    }

    /// <summary>
    /// Sends a request to Kavita to scan the library identified in the URL.
    /// </summary>
    /// <param name="token">The authentication token required for authorization with the Kavita TheArchiver.API.</param>
    /// <returns>A string indicating "Success" if the library scan is initiated successfully, otherwise an error message describing the issue.</returns>
    public static async Task<string> ScanLibrary(string token) {
        try {
            // Tell Kavita to Scan
            // Define the URL and token
            string kavita = "http://10.1.20.3:5000/api/Library/scan?libraryId=5&force=false";

            // Create the HttpClient instance
            using HttpClient client = new HttpClient();

            // Set the Authorization header with the Bearer token
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            // Set other headers if needed
            client.DefaultRequestHeaders.Add("accept", "*/*");

            // Create the content to send with the request (if needed)
            var content = new StringContent("", System.Text.Encoding.UTF8, "application/x-www-form-urlencoded");

            try {
                // Send the POST request
                HttpResponseMessage response = await client.PostAsync(kavita, content);

                // Ensure the request succeeded
                response.EnsureSuccessStatusCode();

                // Read the response content (if needed)
                string responseBody = await response.Content.ReadAsStringAsync();
            }
            catch (HttpRequestException ex) {
                Console.WriteLine($"Request error: {ex.Message}");
            }

            // Wait to allow scan
            await Task.Delay(15000);

            // Return the content as a response
            return "Success";
        }
        catch (Exception ex) {
            // Handle exceptions
            return $"An error occurred: {ex.Message}";
        }
    }
}