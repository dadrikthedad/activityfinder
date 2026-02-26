using AFBack.Common.DTOs;

namespace AFBack.Features.Friendship.DTOs.Responses;

/// <summary>
/// Response for en mottatt venneforespørsel med Pending status.
/// Brukes ved henting av alle ventende venneforespørsler.
/// </summary>
public class PendingFriendshipRequestResponse
{
    public int RequestId { get; set; }
    public UserSummaryDto Sender { get; set; } = null!;
    public DateTime SentAt { get; set; }
}
