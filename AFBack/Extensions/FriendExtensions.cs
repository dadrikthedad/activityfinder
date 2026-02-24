using AFBack.Common.DTOs;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Friendship.Models;
using AFBack.Models;

namespace AFBack.Extensions;

public static class FriendExtensions
{
    public static FriendInvitationDTO ToFriendInvitationDto(
        this FriendshipRequest inv, 
        UserSummaryDto userSummary) =>
        new()
        {
            Id = inv.Id,
            ReceiverId = inv.ReceiverId,
            Status = inv.Status.ToString().ToLower(),
            SentAt = inv.SentAt,
            UserSummary = userSummary // 🎯 Injected parameter
        };
}