using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class EmailOptions
{
    public const string SectionName = "Email";

    [Required]
    public string ApiKey { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string FromAddress { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string SupportAddress { get; set; } = string.Empty;
}
