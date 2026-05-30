using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class SmsOptions
{
    public const string SectionName = "Sms";

    [Required]
    public string ApiUsername { get; set; } = string.Empty;

    [Required]
    public string ApiPassword { get; set; } = string.Empty;

    [Required]
    public string FromNumber { get; set; } = string.Empty;
}
