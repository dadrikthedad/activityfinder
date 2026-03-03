using AFBack.Common.DTOs;

namespace AFBack.Features.Auth.DTOs.Response;

/// <summary>
/// LoginResponse arver fra TokenResponse, samt legger til UserSummary for brukerens profilinfo som frontend trenger
/// </summary>
public class LoginResponse : TokenResponse
{
    public required UserSummaryDto User { get; init; }
}
