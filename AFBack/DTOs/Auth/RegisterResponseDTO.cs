namespace AFBack.DTOs.Auth;

public class RegisterResponseDTO
{
    public string Message { get; set; }
    public int UserId { get; set; }
    public string Email { get; set; }
    public bool EmailConfirmationRequired { get; set; }
    public VerificationMethodsDTO? VerificationMethods { get; set; }
}

