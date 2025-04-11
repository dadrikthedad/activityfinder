using AFBack.Models;

namespace AFBack.DTOs;

// Henter informasjonen fra UserDTO for å vise epost på securitycred siden. Kan brukes senere til å vise info lett og greit, kanskje senere på andre sider
// GUL Advarsel - Alt annet enn UserId, Email og Passord brukes ikke her eller i USerDTO
public class UserDTO
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string Country { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string? PostalCode { get; set; }
    public Gender? Gender { get; set; }
}