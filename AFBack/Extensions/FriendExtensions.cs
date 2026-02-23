using AFBack.Common.DTOs;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Extensions;

public static class FriendExtensions
{
    public static FriendInvitationDTO ToFriendInvitationDto(
        this FriendInvitation inv, 
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