using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class CorsOptions
{
    public const string SectionName = "Cors";

    [Required]
    public List<string> AllowedOrigins { get; set; } = [];
}
