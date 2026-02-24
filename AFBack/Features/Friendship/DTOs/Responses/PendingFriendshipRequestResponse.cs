using AFBack.Common.DTOs;

namespace AFBack.Features.Friendship.DTOs.Responses;

public class PendingFriendshipRequestResponse
{
    public int RequestId { get; set; }
    public UserSummaryDto Sender { get; set; } = null!;
    public DateTime SentAt { get; set; }
}
