using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class AppOptions
{
    public const string SectionName = "App";

    [Required]
    public string BaseUrl { get; set; } = string.Empty;
}
