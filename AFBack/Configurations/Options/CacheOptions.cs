using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class CacheOptions
{
    public const string SectionName = "CacheSettings";

    public string UserSummaryKeyPrefix { get; set; } = "user:summary:";
    public bool EnableCaching { get; set; } = true;

    [Range(1, 1440, ErrorMessage = "CanSendCacheDurationMinutes must be between 1 and 1440")]
    public int CanSendCacheDurationMinutes { get; set; } = 5;
}
