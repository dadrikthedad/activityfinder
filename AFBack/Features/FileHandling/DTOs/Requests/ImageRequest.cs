using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.FileHandling.DTOs.Requests;

/// <summary>
/// Request for opplastning av et bilde. Egenskaper: IFormFile File
/// </summary>
public class ImageRequest
{
    [Required(ErrorMessage = "File is required")]
    public IFormFile File { get; set; } = null!;
}
