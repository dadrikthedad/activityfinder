using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateLocationDTO
{
    [Required(ErrorMessage = "Must be a valid country code.")]
    [MaxLength(2, ErrorMessage = "Country code must be a valid ISO 3166-1 alpha-2 code, e.g., 'NO'.")]
    public string Country { get; set; }

    [Required]
    [MaxLength(100, ErrorMessage = "Region name can't be more than 100 characters.")]
    public string Region { get; set; }
}