using System.Net;
using System.Text;
using System.Text.Json;
using System.Web;
using HtmlAgilityPack;

namespace TheArchiver.DownloadPluginAPI.Helpers;

public static class HtmlHelper {
    
    /// <summary>
    /// Asynchronously fetches the content of a webpage given its URL.
    /// </summary>
    /// <param name="url">The URL of the webpage to fetch content from.</param>
    /// <returns>A task representing the asynchronous operation. The task result is the content of the webpage as a string, or null if the request fails.</returns>
    public static async Task<string?> GetWebsiteContent(string url, int timeout = 100) {
        // Check if flaresolver is up, use that if so
        if(await IsCloudflareProxyUp())
            return await GetWebsiteContentCloudFlare(url, timeout);
        
        using var httpClient = new HttpClient();
        httpClient.Timeout = TimeSpan.FromSeconds(timeout);
        httpClient.DefaultRequestHeaders.Add(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0");

        // Send request and fetch the webpage content
        var response = await httpClient.GetAsync(url);

        if (!response.IsSuccessStatusCode) {
            return null;
        }

        return await response.Content.ReadAsStringAsync();
    }

    /// <summary>
    /// Asynchronously fetches the content of a webpage given its URL, with Cloudflare solving
    /// </summary>
    /// <param name="url">The URL of the webpage to fetch content from.</param>
    /// <returns>A task representing the asynchronous operation. The task result is the content of the webpage as a string, or null if the request fails.</returns>
    public static async Task<string?> GetWebsiteContentCloudFlare(string website, int timeout = 60000) {
        Console.WriteLine("Using Cloudflare");
        // Load the JSON payload
        var requestData = new {
            cmd = "request.get",
            url = website,
            maxTimeout = timeout,
            max_timeout = timeout
        };

        // Serialize into json string
        var jsonPayload = JsonSerializer.Serialize(requestData);

        using var httpClient = new HttpClient();
        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "http://localhost:8080/v1") {
            Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
        };

        // Send request and fetch the webpage content
        var response = await httpClient.SendAsync(requestMessage);

        if (!response.IsSuccessStatusCode) {
            return null;
        }

        // Parse the Results
        var resultJson = await response.Content.ReadAsStringAsync();
        Console.WriteLine(resultJson);
        var jsonDocument = JsonDocument.Parse(resultJson);

        // Try with what is expected
        if (jsonDocument.RootElement.TryGetProperty("solution", out var solutionElement) &&
            solutionElement.TryGetProperty("response", out var responsePropertySolution)) {
            return responsePropertySolution.GetString();
        }

        return jsonDocument.RootElement.TryGetProperty("response", out var responseProperty) ? responseProperty.GetString() :
            // Nothing there, guess failed
            null;
    }

    /// <summary>
    /// Downloads webpage content while sending cookies derived from a JSON string.
    /// </summary>
    /// <param name="url">The URL of the webpage to fetch the data from.</param>
    /// <param name="cookiesJson">JSON string containing key-value pairs for cookies.</param>
    /// <returns>Downloaded content as a string.</returns>
    public static async Task<string> GetWebsiteContentsWithCookiesAsync(string url, string cookiesJson) {
        // Create an HTTP client handler to manage cookies
        var cookieContainer = new CookieContainer();
        var handler = new HttpClientHandler {
            CookieContainer = cookieContainer
        };

        // Add cookies from the provided JSON
        AddCookiesFromJson(cookieContainer, new Uri(url), cookiesJson);

        // Initialize HttpClient
        using (var httpClient = new HttpClient(handler)) {
            httpClient.Timeout = TimeSpan.FromMinutes(5);

            try {
                // Perform HTTP GET request to fetch content
                var response = await httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                // Return the webpage content as a string
                return await response.Content.ReadAsStringAsync();
            }
            catch (Exception ex) {
                Console.WriteLine($"Error fetching webpage content: {ex.Message}");
                throw;
            }
        }
    }

    /// <summary>
    /// Parses a JSON string and adds cookies to the provided CookieContainer.
    /// </summary>
    /// <param name="cookieContainer">CookieContainer instance to add cookies to.</param>
    /// <param name="uri">The Uri to associate the cookies with.</param>
    /// <param name="cookiesJson">JSON string containing cookies in key-value format.</param>
    private static void AddCookiesFromJson(CookieContainer cookieContainer, Uri uri, string cookiesJson) {
        try {
            // Parse the JSON into a dictionary
            var cookies = JsonSerializer.Deserialize<Dictionary<string, string>>(cookiesJson);

            if (cookies != null) {
                foreach (var cookie in cookies) {
                    cookieContainer.Add(uri, new Cookie(cookie.Key, cookie.Value));
                }
            }
        }
        catch (JsonException ex) {
            Console.WriteLine($"Error parsing cookies JSON: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Extracts the inner text of a specified HTML node using an XPath expression.
    /// </summary>
    /// <param name="xpath">The XPath expression used to locate the HTML node.</param>
    /// <param name="html">The HTML content as a string to parse and query.</param>
    /// <returns>The inner text of the specified HTML node, or null if the node is not found.</returns>
    public static string? GetHtmlNodeStringByXPath(string xpath, string html) {
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(html);
        return HttpUtility.HtmlDecode(htmlDoc.DocumentNode.SelectSingleNode(xpath)?.InnerText);
    }

    /// <summary>
    /// Retrieves a specified HTML node using an XPath expression.
    /// </summary>
    /// <param name="xpath">The XPath expression used to locate the HTML node.</param>
    /// <param name="html">The HTML content as a string to parse and query.</param>
    /// <returns>The HTML node if found, otherwise null.</returns>
    public static HtmlNode? GetHtmlNodeByXPath(string xpath, string html) {
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(html);
        return htmlDoc.DocumentNode.SelectSingleNode(xpath);
    }

    /// <summary>
    /// Extracts the inner texts of all matching HTML nodes using an XPath expression.
    /// </summary>
    /// <param name="xpath">The XPath expression used to locate the HTML nodes.</param>
    /// <param name="html">The HTML content as a string to parse and query.</param>
    /// <returns>A list of inner texts of the matching HTML nodes, or null if no nodes are found.</returns>
    public static List<string>? GetHtmlNodesStringsByXPath(string xpath, string html) {
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(html);
        return htmlDoc.DocumentNode.SelectNodes(xpath)?.Select(x => HttpUtility.HtmlDecode(x.InnerText)).ToList();
    }

    /// <summary>
    /// Retrieves a list of HTML nodes matching the given XPath expression from the provided HTML content.
    /// </summary>
    /// <param name="xpath">The XPath expression used to locate the HTML nodes.</param>
    /// <param name="html">The HTML content as a string to parse and query.</param>
    /// <returns>A list of HTML nodes matching the XPath expression, or null if no nodes are found.</returns>
    public static List<HtmlNode>? GetHtmlNodesByXPath(string xpath, string html) {
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(html);
        return htmlDoc.DocumentNode.SelectNodes(xpath)?.ToList();
    }

    /// <summary>
    /// Retrieves an HTML node by its class name from the provided HTML content.
    /// </summary>
    /// <param name="className">The class name of the HTML node to locate.</param>
    /// <param name="html">The HTML content as a string to parse and search within.</param>
    /// <returns>The HTML node with the specified class name, or null if no matching node is found.</returns>
    public static HtmlNode? GetHtmlNodeById(string className, string html) {
        var htmlDoc = new HtmlDocument();
        htmlDoc.LoadHtml(html);
        return htmlDoc.GetElementbyId(className);
    }

    /// <summary>
    /// Retrieves the value of a specified attribute from an HTML node.
    /// </summary>
    /// <param name="attributeName">The name of the attribute to retrieve the value from.</param>
    /// <param name="node">The HTML node containing the attribute.</param>
    /// <returns>The value of the specified attribute, or null if the attribute does not exist.</returns>
    public static string? GetHtmlAttribute(string attributeName, HtmlNode node) {
        return HttpUtility.HtmlDecode(node.Attributes[attributeName]?.Value);
    }

    /// <summary>
    /// Retrieves the value of a specified attribute from an HTML node with a given class name within the provided HTML content.
    /// </summary>
    /// <param name="id">The class name of the HTML node to locate.</param>
    /// <param name="attributeName">The name of the attribute to retrieve from the located HTML node.</param>
    /// <param name="html">The HTML content as a string to parse and search within.</param>
    /// <returns>The value of the specified attribute, or null if the node or attribute is not found.</returns>
    public static string? GetAttributeById(string id, string attributeName, string html) {
        var htmlNode = GetHtmlNodeById(id, html);
        return htmlNode != null ? GetHtmlAttribute(attributeName, htmlNode) : null;
    }

    /// <summary>
    /// Determines asynchronously whether a specified service or website is available by performing an HTTP GET request.
    /// </summary>
    /// <param name="url">The URL of the service or website to check for availability.</param>
    /// <returns>A task representing the asynchronous operation. The task result is a boolean value: true if the service is available and returns a successful 2xx status code, otherwise false.</returns>
    public static async Task<bool> IsCloudflareProxyUp() {
        try {
            var requestData = new {
                cmd = "request.get",
                url = "https://google.com",
                maxTimeout = 60000
            };

            // Serialize into json string
            var jsonPayload = JsonSerializer.Serialize(requestData);

            using var httpClient = new HttpClient();
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, "http://localhost:8080/v1") {
                Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
            };

            // Send request and fetch the webpage content
            var response = await httpClient.SendAsync(requestMessage);
            return response.IsSuccessStatusCode; // Returns true if 2xx status code
        }
        catch {
            return false; // Handle exceptions like timeouts or unreachable host
        }
    }
}