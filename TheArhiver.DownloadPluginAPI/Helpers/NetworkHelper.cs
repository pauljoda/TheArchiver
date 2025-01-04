using System.Net;

namespace TheArhiver.DownloadPluginAPI.Helpers;

public class NetworkHelper {
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