using FFMpegCore;

using var cts = new CancellationTokenSource();
var token = cts.Token;

Console.CancelKeyPress += (sender, eventArgs) => {
    Console.WriteLine("Cancellation requested...");
    cts.Cancel();
    eventArgs.Cancel = true;
};

try {
    while (!token.IsCancellationRequested) {
        Console.WriteLine("Looking for files");

        string[] files = Directory.GetFiles(Environment.GetEnvironmentVariable("ScanLocation"));
        if (files.Length > 0) {
            var audioFiles = files.Where(f => f.Contains("-audio")).ToList();
            var videoFiles = files.Where(f => f.Contains("-video")).ToList();

            foreach (var audio in audioFiles) {
                var videoBaseName = Path.GetFileNameWithoutExtension(audio)?.Replace("-audio", "-video");
                var video = videoFiles.FirstOrDefault(f =>
                    Path.GetFileNameWithoutExtension(f) == videoBaseName);

                if (video != null) {
                    Console.WriteLine("Combining");
                    try {
                        var success = await Task.Run(() =>
                            FFMpeg.ReplaceAudio(video, audio, video.Replace("-video", "")), token);

                        if (success) {
                            File.Delete(video);
                            File.Delete(audio);
                        }
                    }
                    catch (Exception ex) {
                        Console.WriteLine(ex);
                    }
                }
            }
        }

        try {
            await Task.Delay(10000, token);
        }
        catch (TaskCanceledException) {
            Console.WriteLine("Task was canceled during delay.");
            break;
        }
    }

    Console.WriteLine("Operation canceled.");
}
finally {
    Console.WriteLine("Exiting gracefully.");
}