using AFBack.Common.DTOs;
using AFBack.Features.Blocking.DTOs;

namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class CriticalBootstrapResponse
{
    public required UserResponse User { get; init; }
    public required UserProfileResponse Profile { get; init; }
    public required UserSettingsResponse Settings { get; init; }
    public required List<BlockedUserResponse> BlockedUsers { get; init; }
    
}
