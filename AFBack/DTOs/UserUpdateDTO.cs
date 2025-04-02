using System.ComponentModel.DataAnnotations;
using AFBack.Models;

namespace AFBack.DTOs;

// ✅ Endre kun det som trengs i hvert enkelt patch-kall

public class UpdateFirstNameDTO
{
    [Required(ErrorMessage = "First name is required.")]
    [MaxLength(50, ErrorMessage = "First name can't be more than 50 characters.")]
    public string FirstName { get; set; } = null!;
}

public class UpdateMiddleNameDTO
{
    [MaxLength(50, ErrorMessage = "Middle name can't be more than 50 characters.")]
    public string? MiddleName { get; set; }
}

public class UpdateLastNameDTO
{
    [Required(ErrorMessage = "Last name is required.")]
    [MaxLength(50, ErrorMessage = "Last name can't be more than 50 characters.")]
    public string LastName { get; set; } = null!;
}

public class UpdatePhoneDTO
{
    [Phone(ErrorMessage = "Invalid phone number format.")]
    [MaxLength(30, ErrorMessage = "Phone number can't be more than 30 characters.")]
    public string? Phone { get; set; }
}


public class UpdatePostalCodeDTO
{
    [MaxLength(25, ErrorMessage = "Postal code can't be more than 25 characters.")]
    public string? PostalCode { get; set; }
}
