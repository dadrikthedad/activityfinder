using AFBack.Common.DTOs;
using AFBack.Features.Notifications.DTOs.Responses;

namespace AFBack.Features.Friendship.DTOs.Responses;

/// <summary>
/// Response til godkjenner + payload i SignalR/SyncEvent
/// </summary>
public class FriendshipAcceptedResponse
{
    public UserSummaryDto Friend { get; set; } = null!;
    public NotificationResponse? NotificationResponse { get; set; }
}
