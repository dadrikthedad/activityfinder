namespace AFBack.Features.Auth.DTOs.Response;

public class TokenResponse
{
    public required string AccessToken { get; init; }
    public required string RefreshToken { get; init; }
    public required DateTime AccessTokenExpires { get; init; }
    public required DateTime RefreshTokenExpires { get; init; }
}
