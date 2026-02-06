namespace AFBack.Features.Auth.DTOs.Response;

public class SignupResponse
{
    public required string UserId { get; init; }
    public required string Email { get; init; }
    public required string Message { get; init; }
    public required bool EmailConfirmationRequired { get; init; }
}
