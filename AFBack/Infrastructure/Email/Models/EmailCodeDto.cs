namespace AFBack.Infrastructure.Email.Models;

public sealed record EmailCodeDto(
    string Email,
    string Code,
    string BaseUrl
);
