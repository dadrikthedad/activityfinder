using AFBack.Models;

namespace AFBack.DTOs;

//Hente informasjon fra brukeren til profil
public class UserDTO
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string Country { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string? PostalCode { get; set; }
    public Gender? Gender { get; set; }
}