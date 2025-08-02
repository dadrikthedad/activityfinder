using AFBack.DTOs;
using AFBack.Models;

namespace AFBack.Extensions;

public static class FriendExtensions
{
    public static FriendInvitationDTO ToFriendInvitationDto(FriendInvitation inv) =>
        new()
        {
            Id = inv.Id,
            ReceiverId = inv.ReceiverId,
            Status = inv.Status.ToString().ToLower(),
            SentAt = inv.SentAt,
            UserSummary = new UserSummaryDTO
            {
                Id = inv.Sender.Id,
                FullName = inv.Sender.FullName,
                ProfileImageUrl = inv.Sender.Profile?.ProfileImageUrl
            }
        };
}