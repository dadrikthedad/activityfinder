namespace AFBack.Infrastructure.Email.Models;

public sealed record VerificationEmailDto(
    string Email,
    string VerificationCode,
    string BaseUrl
);
