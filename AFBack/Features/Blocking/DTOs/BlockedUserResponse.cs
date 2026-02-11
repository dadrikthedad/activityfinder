namespace AFBack.Features.Blocking.DTOs;

public class BlockedUserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public DateTime BlockedAt { get; set; }
}
