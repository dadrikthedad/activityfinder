using AFBack.Common.DTOs;
using AFBack.Features.Notifications.DTOs.Responses;

namespace AFBack.Features.Friendship.DTOs.Responses;

public class ReceivedPendingFriendshipRequestPayload
{
    public PendingFriendshipRequestResponse PendingFriendshipRequestResponse { get; set; } = null!;
    
    public NotificationResponse NotificationResponse { get; set; } = null!;
}
