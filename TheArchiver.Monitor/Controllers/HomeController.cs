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
            var vm = new StatusCountsViewModel
            {
                QueueCount = queueCount,
                FailedCount = failedCount
            };
            return View(vm);
        }
        catch (Exception ex)
        {
            ViewBag.Error = ex.Message;
            return View();
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
                Tail = "100",
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

    public IActionResult Error()
    {
        return View();
    }
}