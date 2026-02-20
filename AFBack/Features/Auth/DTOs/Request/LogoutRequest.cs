using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Auth.DTOs.Request;

/// <summary>
/// Request for å logge ut. Revokerer refresh token og blacklister access token.
/// </summary>
public class LogoutRequest
{
    [Required(ErrorMessage = "Refresh token is required")]
    public required string RefreshToken { get; init; }
}
