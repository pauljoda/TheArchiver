namespace TheArchiver.DownloadPluginAPI.Helpers;

public static class StringHelper {
    
    /// <summary>
    /// Removes invalid characters from the input string that are not allowed in file names.
    /// </summary>
    /// <param name="input">The input string to sanitize.</param>
    /// <returns>A sanitized string with invalid characters removed.</returns>
    public static string Sanitize(string input) {
        var invalidChars = System.IO.Path.GetInvalidFileNameChars();
        input = invalidChars.Aggregate(input, (current, ch) => current.Replace(ch.ToString(), string.Empty));
        
        input = System.Text.RegularExpressions.Regex.Replace(input, @"\[[^\]]*\]", string.Empty);
        
        // Windows file systems do not keep any . at the end, all get removed so we will just remove
        input = input.Trim();
        return input.TrimEnd('.');
    }

    /// <summary>
    /// Removes numeric characters and leading or trailing whitespace from the input string.
    /// </summary>
    /// <param name="input">The input string to process.</param>
    /// <returns>A string with all numeric characters removed and whitespace trimmed.</returns>
    public static string RemoveNumbersAndSpaces(string input) =>
        new string(input.Where(c => !char.IsDigit(c)).ToArray()).Trim();
}