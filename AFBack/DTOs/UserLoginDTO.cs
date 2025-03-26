namespace AFBack.DTOs;
using System.ComponentModel.DataAnnotations;

public class UserLoginDTO
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string Email { get; set; } = null!;


    [Required(ErrorMessage = "Password is required.")]
    [MaxLength(225, ErrorMessage = "Password cannot be longer than 225 characters.")]
    public string Password { get; set; } = null!;
    
    // Lokasjon logget inn fra
    public string Ip { get; set; }
    public string City { get; set; }
    public string Region { get; set; }
    public string Country { get; set; }
    public string Country_name { get; set; }
}