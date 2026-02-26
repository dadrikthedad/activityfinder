using AFBack.Common.DTOs;

namespace AFBack.Features.Friendship.DTOs.Responses;

/// <summary>
/// Response for vennelisten til en annen bruker.
/// Felles venner vises først, begge lister sortert alfabetisk.
/// </summary>
public class UserFriendsResponse
{
    public List<UserSummaryDto> MutualFriends { get; set; } = [];
    public List<UserSummaryDto> OtherFriends { get; set; } = [];
}
