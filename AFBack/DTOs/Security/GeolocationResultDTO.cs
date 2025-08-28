namespace AFBack.DTOs.Security;

public class GeolocationResultDTO
{
    public string? City { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public bool Success { get; set; } = false;
}