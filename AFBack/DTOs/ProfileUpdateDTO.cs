namespace AFBack.DTOs;
// For å oppdatere profilen.
public class ProfileUpdateDTO
{
    public string? ProfileImageUrl { get; set; }
    public string? Bio { get; set; }
    public List<string> Websites { get; set; } = new();
}
