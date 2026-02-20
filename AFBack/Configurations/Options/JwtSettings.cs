using System.ComponentModel.DataAnnotations;

namespace AFBack.Configurations.Options;

/// <summary>
/// JwtSettings er innstillingene relatert til JWT-token satt i appsettings.json.
/// Dette brukes for å kaste en feil hvis noe ikke stemmer i appsettings. Kan bruke DataAnnotations
/// </summary>
public class JwtSettings
{
    public const string SectionName = "JwtSettings";
  
    [Required(ErrorMessage = "Secret Key is required")]
    [MinLength(32, ErrorMessage = "Secret Key must be more than 32 characters")]
    public string Key { get; set; } = string.Empty;
  
    [Required(ErrorMessage = "Issuer is required")]
    public string Issuer { get; set; } = string.Empty;
  
    [Required(ErrorMessage = "Audience is required")]
    public string Audience { get; set; } = string.Empty;
}

