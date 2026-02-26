

namespace AFBack.Configurations.Options;

public static class SupportTicketFileConfig
{
    // 5MB each file
    public const long TicketMaxFileSizeBytes = 5 * 1024 * 1024;
    // Max 5 files per request
    public const int TicketMaxFileCount = 5;
    // 25MB total request
    public const long TicketMaxTotalRequestSize = 25 * 1024 * 1024;


    public const int MaxUserReportsPerDay = 10;


    public static readonly HashSet<string> SupportTicketExtensions =
    [
        // Bilder
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
  
        // Dokumenter
        ".pdf",
        ".txt",
        ".log"
    ];


    public static readonly HashSet<string> SupportTicketContentTypes =
    [
        // Bilder
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
  
        // Dokumenter
        "application/pdf",
        "text/plain"  // Dekker både .txt og .log
    ];
}

