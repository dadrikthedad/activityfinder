namespace AFBack.Infrastructure.Email.Models;

public sealed record WelcomeEmailDto(
    string Email,
    string UserName
);
