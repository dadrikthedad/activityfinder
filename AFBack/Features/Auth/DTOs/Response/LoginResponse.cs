using AFBack.DTOs;

namespace AFBack.Features.Auth.DTOs.Response;

public class LoginResponse
{
    public required string AccessToken { get; init; }
    public required string RefreshToken { get; init; }
    public required DateTime AccessTokenExpires { get; init; }
    public required DateTime RefreshTokenExpires { get; init; }
    public required UserSummaryDto User { get; init; }
}
