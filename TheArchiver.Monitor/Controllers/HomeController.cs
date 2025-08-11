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
            var containers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters());
            var workerContainer = containers.FirstOrDefault(c => 
                c.Names.Any(name => name.Contains("background-download") || name.Contains("archiver-background-download")));

            if (workerContainer == null)
            {
                return Content("Background download container not found");
            }

            var logStream = await _dockerClient.Containers.GetContainerLogsAsync(
                workerContainer.ID,
                new ContainerLogsParameters()
                {
                    ShowStdout = true,
                    ShowStderr = true,
                    Tail = "100",
                    Follow = false
                });

            using var reader = new StreamReader(logStream);
            var logs = await reader.ReadToEndAsync();
            
            return Content(logs, "text/plain");
        }
        catch (Exception ex)
        {
            return Content($"Error reading logs: {ex.Message}");
        }
    }

    public IActionResult Error()
    {
        return View();
    }
}