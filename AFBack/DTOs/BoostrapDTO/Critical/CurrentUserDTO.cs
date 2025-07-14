namespace AFBack.DTOs.BoostrapDTO;

public class CurrentUserDTO
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
}