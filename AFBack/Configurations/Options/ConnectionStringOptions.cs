using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class ConnectionStringOptions
{
    public const string SectionName = "ConnectionStrings";

    [Required]
    public string DatabaseConnection { get; set; } = string.Empty;

    [Required]
    public string Redis { get; set; } = string.Empty;
}
