using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Dev.DTOs;

public class DevUserDto
{
    public string Email { get; init; } = null!;
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }
}
