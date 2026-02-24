using AFBack.Common.DTOs;
using AFBack.Features.Notifications.DTOs.Responses;

namespace AFBack.Features.Friendship.DTOs.Responses;

public class FriendshipRequestResponse
{
    public int Id { get; set; }
    public UserSummaryDto Sender { get; set; } = null!;
    public DateTime SentAt { get; set; }
    
    public NotificationResponse NotificationResponse { get; set; } = null!;
}
