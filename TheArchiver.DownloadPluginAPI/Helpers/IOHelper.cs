namespace TheArchiver.DownloadPluginAPI.Helpers;

public static class IOHelper {
    /// <summary>
    /// Downloads a file from the specified URL and saves it to the given file path.
    /// </summary>
    /// <param name="client">An instance of HttpClient used to perform the HTTP request.</param>
    /// <param name="url">The URL of the file to be downloaded.</param>
    /// <param name="filePath">The local file path where the downloaded file will be saved.</param>
    /// <returns>A boolean value indicating whether the download operation was successful.</returns>
    /// <exception cref="HttpRequestException">Thrown if the HTTP request fails.</exception>
    /// <exception cref="IOException">Thrown if an error occurs while writing the file to the specified path.</exception>
    /// <exception cref="UnauthorizedAccessException">Thrown if access to the specified file path is denied.</exception>
    public static async Task DownloadFilesAsync(HttpClient client, Uri url, string filePath) {
        try {
            await using var stream = await client.GetStreamAsync(url);
            await using var fs = new FileStream(filePath, FileMode.OpenOrCreate);
            await stream.CopyToAsync(fs);
        }
        catch (Exception ex) {
            Console.WriteLine(ex);
        }
    }
    
    /// <summary>
    /// Compresses the specified directory into a zip file at the specified location.
    /// </summary>
    /// <param name="sourceDirectory">The path to the directory that will be zipped.</param>
    /// <param name="zipFilePath">The file path where the resulting zip file will be created.</param>
    /// <returns>Returns true if the directory was successfully zipped, false if the source directory does not exist.</returns>
    public static bool ZipDirectory(string sourceDirectory) {
        string zipFileName = Path.Combine(Directory.GetParent(sourceDirectory)?.FullName ?? "",
            Path.GetFileName(sourceDirectory) + ".zip");
        if (Directory.Exists(sourceDirectory)) {
            // If a zip file already exists at the target location, delete it to avoid conflicts
            if (File.Exists(zipFileName)) {
                File.Delete(zipFileName);
            }

            System.IO.Compression.ZipFile.CreateFromDirectory(sourceDirectory, zipFileName);
            Console.WriteLine("Directory successfully zipped to: " + zipFileName);
            return true;
        }

        Console.WriteLine("Source directory does not exist.");
        return false;
    }

    /// <summary>
    /// Marks the specified directory and its contents as hidden.
    /// </summary>
    /// <param name="path">The path to the directory that will be marked as hidden.</param>
    /// <returns>Returns true if the directory and its contents were successfully marked as hidden, false otherwise.</returns>
    public static bool MarkAsHidden(string path) {
        try {
            if (Directory.Exists(path)) {
                // Mark the directory as hidden
                var directoryInfo = new DirectoryInfo(path);
                directoryInfo.Attributes |= FileAttributes.Hidden;

                // Mark all files and subdirectories inside the directory as hidden
                var files = directoryInfo.GetFiles();
                foreach (var file in files) {
                    file.Attributes |= FileAttributes.Hidden;
                }

                var subDirectories = directoryInfo.GetDirectories();
                foreach (var subDirectory in subDirectories) {
                    subDirectory.Attributes |= FileAttributes.Hidden;
                }

                Console.WriteLine($"The folder and all child items in {path} have been marked as hidden.");
                return true;
            }

            Console.WriteLine($"Directory {path} does not exist.");
            return false;
        }
        catch (Exception ex) {
            Console.WriteLine("An error occurred while marking items as hidden: " + ex.Message);
            return false;
        }
    }

    /// <summary>
    /// Moves a file from the specified source path to the specified destination path.
    /// </summary>
    /// <param name="sourceFile">The file path of the source file to be moved.</param>
    /// <param name="destinationFile">The target file path where the file will be moved.</param>
    /// <returns>Returns true if the file was successfully moved, false if an error occurred.</returns>
    public static bool MoveFile(string sourceFile, string destinationFile) {
        try {
            if (File.Exists(sourceFile)) {
                File.Move(sourceFile, destinationFile);
                Console.WriteLine($"Zip file moved to: {destinationFile}");
            }
            else {
                Console.WriteLine($"Zip file {sourceFile} does not exist.");
            }

            return true;
        }
        catch (Exception ex) {
            Console.WriteLine("An error occurred while moving the zip file: " + ex.Message);
            return false;
        }
    }

    /// <summary>
    /// Checks if a file with the specified name (regardless of extension) exists in the given directory.
    /// </summary>
    /// <param name="directoryPath">The path of the directory to search for the file.</param>
    /// <param name="fileNameWithoutExtension">The name of the file without the extension to search for.</param>
    /// <returns>Returns true if a file with the specified name and any extension exists in the directory, false otherwise.</returns>
    /// <exception cref="ArgumentException">Thrown when the directory path or file name is null or empty.</exception>
    /// <exception cref="DirectoryNotFoundException">Thrown when the specified directory does not exist.</exception>
    public static bool FileExistsWithAnyExtension(string directoryPath, string fileNameWithoutExtension) {
        if (string.IsNullOrWhiteSpace(directoryPath) || string.IsNullOrWhiteSpace(fileNameWithoutExtension))
            throw new ArgumentException("Directory path and file name cannot be null or empty.");

        if (!Directory.Exists(directoryPath))
            throw new DirectoryNotFoundException("Directory does not exist.");

        string[] matchingFiles = Directory.GetFiles(directoryPath, $"{fileNameWithoutExtension}.*");
        return matchingFiles.Any(); // true if any file with the given name exists, regardless of extension
    }

    /// <summary>
    /// Removes leading whitespace from the names of directories and their subdirectories within the specified directory.
    /// </summary>
    /// <param name="directory">The path to the root directory where leading whitespace in directory names will be removed.</param>
    public static void RemoveLeadingWhitespace(string directory) {
        // Process directories first
        var directories = Directory.GetDirectories(directory);

        foreach (var dir in directories) {
            var directoryInfo = new DirectoryInfo(dir);
            var trimmedDirName = Path.Combine(
                directoryInfo.Parent?.FullName ?? "",
                directoryInfo.Name.TrimStart());

            if (!directoryInfo.FullName.Equals(trimmedDirName)) {
                Directory.Move(directoryInfo.FullName, trimmedDirName);
                Console.WriteLine($"Renamed folder to: {trimmedDirName}");
            }

            // Recursive call for sub-directories
            RemoveLeadingWhitespace(trimmedDirName);
        }
        
        // Process files in the current directory
        var files = Directory.GetFiles(directory);
        foreach (var file in files) {
            var trimmedFileName = Path.Combine(
                Path.GetDirectoryName(file),
                Path.GetFileName(file).TrimStart());

            if (!file.Equals(trimmedFileName)) {
                File.Move(file, trimmedFileName);
            }
        }
    }
}