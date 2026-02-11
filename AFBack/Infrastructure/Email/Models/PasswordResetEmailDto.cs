namespace AFBack.Infrastructure.Email.Models;

public sealed record PasswordResetEmailDto(
    string Email,
    string ResetCode,
    string BaseUrl
);
