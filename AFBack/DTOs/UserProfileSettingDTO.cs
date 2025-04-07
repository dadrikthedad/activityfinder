using AFBack.Models;

namespace AFBack.DTOs;

public class UserProfileSettingDTO
{
    public int UserId { get; set; } 
    public string? FirstName { get; set; }
    public string MiddleName { get; set; } = string.Empty;
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string Country { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string? PostalCode { get; set; }
    public Gender? Gender { get; set; }
    
}