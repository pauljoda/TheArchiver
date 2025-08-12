using Microsoft.AspNetCore.Mvc;
using TheArchiver.Monitor.Services;
using Docker.DotNet;
using Docker.DotNet.Models;
using TheArchiver.Monitor.Models;

namespace TheArchiver.Monitor.Controllers;

public class HomeController : Controller
{
    private readonly QueueMonitorService _queueMonitorService;
    private readonly IDockerClient _dockerClient;

    public HomeController(QueueMonitorService queueMonitorService, IDockerClient dockerClient)
    {
        _queueMonitorService = queueMonitorService;
        _dockerClient = dockerClient;
    }

    public async Task<IActionResult> Index()
    {
        try
        {
            var (queueCount, failedCount) = await _queueMonitorService.GetStatusCountsAsync();
            var queueItems = await _queueMonitorService.GetQueueItemsAsync();
            var failedItems = await _queueMonitorService.GetFailedDownloadsAsync();
            
            var vm = new QueueAndFailedViewModel
            {
                QueueCount = queueCount,
                FailedCount = failedCount,
                QueueItems = queueItems,
                FailedItems = failedItems
            };
            return View(vm);
        }
        catch (Exception ex)
        {
            ViewBag.Error = ex.Message;
            return View(new QueueAndFailedViewModel());
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetQueueStatus()
    {
        try
        {
            var (queueCount, failedCount) = await _queueMonitorService.GetStatusCountsAsync();
            return Json(new { queueCount, failedCount });
        }
        catch (Exception ex)
        {
            return Json(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetQueueData()
    {
        try
        {
            var queueItems = await _queueMonitorService.GetQueueItemsAsync();
            var failedItems = await _queueMonitorService.GetFailedDownloadsAsync();
            return Json(new { 
                queueItems = queueItems.Select(q => new { q.Id, q.Url }),
                failedItems = failedItems.Select(f => new { f.Id, f.Url, f.ErrorMessage })
            });
        }
        catch (Exception ex)
        {
            return Json(new { error = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> StreamLogs()
    {
        try
        {
            // Quick connectivity check; throws on no access to Docker Engine
            await _dockerClient.System.PingAsync();

            var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters());
            var workerContainer = containers.FirstOrDefault(c =>
                c.Names.Any(name => name.Contains("background-download") || name.Contains("archiver-background-download")));

            if (workerContainer == null)
            {
                return Content("Background download container not found");
            }

            // Inspect container to determine if TTY is enabled
            var inspect = await _dockerClient.Containers.InspectContainerAsync(workerContainer.ID);
            var tty = inspect.Config?.Tty ?? false;

            var parameters = new ContainerLogsParameters
            {
                ShowStdout = true,
                ShowStderr = true,
                Tail = "all",
                Follow = false,
                Timestamps = false
            };

            // Use recommended overload that respects TTY and proper multiplexing
            using var multiplexed = await _dockerClient.Containers.GetContainerLogsAsync(
                workerContainer.ID,
                tty,
                parameters,
                CancellationToken.None);

            // Read output (handles both TTY and non-TTY)
            var result = await multiplexed.ReadOutputToEndAsync(CancellationToken.None);
            var logs = string.Concat(result.stdout, result.stderr);

            return Content(logs, "text/plain");
        }
        catch (DockerApiException ex)
        {
            return Content($"Error reading logs from Docker API: {ex.Message}. Ensure the app can access the Docker Engine (mount /var/run/docker.sock if running in a container, or set DOCKER_HOST if using a remote daemon).", "text/plain");
        }
        catch (System.Net.Http.HttpRequestException ex)
        {
            return Content($"Error reading logs: cannot reach Docker daemon. {ex.Message}. If on macOS/Linux, check permissions to /var/run/docker.sock (e.g., add your user to the docker group or run with sufficient privileges). If remote, set DOCKER_HOST.", "text/plain");
        }
        catch (OperationCanceledException)
        {
            return Content("Error reading logs: Operation canceled.", "text/plain");
        }
        catch (Exception ex)
        {
            return Content($"Error reading logs: {ex.Message}", "text/plain");
        }
    }

    [HttpGet]
    public async Task<IActionResult> Details()
    {
        try
        {
            var vm = new QueueAndFailedViewModel
            {
                QueueItems = await _queueMonitorService.GetQueueItemsAsync(),
                FailedItems = await _queueMonitorService.GetFailedDownloadsAsync()
            };
            return View(vm);
        }
        catch (Exception ex)
        {
            ViewBag.Error = ex.Message;
            return View(new QueueAndFailedViewModel());
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteQueueItem(int id)
    {
        try
        {
            var success = await _queueMonitorService.RemoveQueueItemAsync(id);
            return Json(new { success });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteFailedItem(int id)
    {
        try
        {
            var success = await _queueMonitorService.RemoveFailedDownloadAsync(id);
            return Json(new { success });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<IActionResult> ClearAllQueue()
    {
        try
        {
            var success = await _queueMonitorService.ClearAllQueueItemsAsync();
            return Json(new { success });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete]
    public async Task<IActionResult> ClearAllFailed()
    {
        try
        {
            var success = await _queueMonitorService.ClearAllFailedDownloadsAsync();
            return Json(new { success });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddUrlToQueue([FromBody] AddUrlRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Url))
            {
                return Json(new { success = false, error = "URL is required" });
            }

            if (!Uri.TryCreate(request.Url, UriKind.Absolute, out _))
            {
                return Json(new { success = false, error = "Please provide a valid URL" });
            }

            var success = await _queueMonitorService.AddUrlToQueueAsync(request.Url);
            if (success)
            {
                return Json(new { success = true });
            }
            else
            {
                return Json(new { success = false, error = "URL already exists in queue or failed to add" });
            }
        }
        catch (Exception ex)
        {
            return Json(new { success = false, error = ex.Message });
        }
    }

    public IActionResult Error()
    {
        return View();
    }
}