using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

public class KeyVaultOptions
{
    public const string SectionName = "KeyVault";

    [Required]
    public string Url { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;
}
