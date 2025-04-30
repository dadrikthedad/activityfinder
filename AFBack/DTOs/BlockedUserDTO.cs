namespace AFBack.DTOs;

public class BlockedUserDTO
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public DateTime BlockedAt { get; set; }
}