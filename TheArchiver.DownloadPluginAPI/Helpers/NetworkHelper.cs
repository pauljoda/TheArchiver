using System.Net;

namespace TheArchiver.DownloadPluginAPI.Helpers;

public class NetworkHelper {
    
    /// <summary>
    /// Retrieves the local IPv4 address of the machine.
    /// </summary>
    /// <returns>The local IPv4 address as a string.</returns>
    /// <exception cref="Exception">Thrown when a local IPv4 address cannot be found.</exception>
    public static string GetLocalIpAddress() {
        var host = Dns.GetHostEntry(Dns.GetHostName());
        foreach (var ip in host.AddressList) {
            if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) {
                return ip.ToString(); // Return IPv4 address
            }
        }

        throw new Exception("Local IPv4 address not found!");
    }
}