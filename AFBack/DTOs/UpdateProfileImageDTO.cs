using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateProfileImageDTO
{
    [MaxLength(500)]
    [Url]
    public string ProfileImageUrl { get; set; } = string.Empty;
}