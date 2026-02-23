namespace AFBack.Features.FileHandling.Helpers;

public static class FileHelper
{
    /// <summary>
    /// Formaterer filstørrelsen til GB, MB eller KB utifra størrelse
    /// </summary>
    /// <param name="bytes"></param>
    /// <returns>En formatert string</returns>
    public static string FormatFileSize(long bytes)
    {
        return bytes switch
        {
            >= 1024 * 1024 * 1024 => $"{bytes / (1024.0 * 1024.0 * 1024.0):F2} GB",
            >= 1024 * 1024 => $"{bytes / (1024.0 * 1024.0):F2} MB",
            >= 1024 => $"{bytes / 1024.0:F2} KB",
            _ => $"{bytes} bytes"
        };
    }
    
    
}
