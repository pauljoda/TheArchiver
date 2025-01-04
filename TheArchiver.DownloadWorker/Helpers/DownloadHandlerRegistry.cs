using System.Reflection;
using TheArhiver.DownloadPluginAPI;
using TheArhiver.DownloadPluginAPI.Helpers;

namespace TheArchiver.DownloadWorker.Helpers;

public static class DownloadHandlerRegistry {
    private static readonly Dictionary<string, Type> _downloadHandlers = new();

    public static void Init(string pluginFolderPath) {
        RegisterProviders();
        LoadPlugins(pluginFolderPath);
        Console.WriteLine($"Loaded {_downloadHandlers.Count} providers.");
        foreach (var handler in _downloadHandlers) {
            Console.WriteLine($"  {handler.Key} -> {handler.Value.Name}");
        }
    }
    
    private static void RegisterProviders() {
        Console.WriteLine("Finding local providers...");
        var providerTypes = AppDomain.CurrentDomain.GetAssemblies()
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type =>
                type.GetCustomAttributes(typeof(DownloadHandler), false).Any() &&
                typeof(IDownloadHandler).IsAssignableFrom(type) &&
                !type.IsAbstract &&
                type.IsClass);

        foreach (var type in providerTypes) {
            var attribute = (DownloadHandler)type.GetCustomAttribute(typeof(DownloadHandler));
            if (attribute != null) {
                _downloadHandlers[attribute.BaseUrl] = type;
            }
        }
    }

    private static void LoadPlugins(string pluginFolderPath) {
        Console.WriteLine($"Loading plugins from {pluginFolderPath}... ");
        if (!Directory.Exists(pluginFolderPath)) return;

        var pluginFiles = Directory.GetFiles(pluginFolderPath, "*.dll");

        foreach (var pluginFile in pluginFiles) {
            var assembly = Assembly.LoadFrom(pluginFile);
            var pluginTypes = assembly.GetTypes()
                .Where(type =>
                    type.GetCustomAttributes(typeof(DownloadHandler), false).Any() &&
                    typeof(IDownloadHandler).IsAssignableFrom(type) &&
                    !type.IsAbstract &&
                    type.IsClass);

            foreach (var type in pluginTypes) {
                var attribute = (DownloadHandler)type.GetCustomAttribute(typeof(DownloadHandler));
                if (attribute != null) {
                    _downloadHandlers[attribute.BaseUrl] = type;
                }
            }
        }
    }

    public static IDownloadHandler? GetDownloadHandlerForUrl(string name) {
        var url = UrlHelper.ExtractBaseUrl(name);
        if (_downloadHandlers.TryGetValue(url, out var type)) 
            return (IDownloadHandler)Activator.CreateInstance(type);
        return null;
    }
}