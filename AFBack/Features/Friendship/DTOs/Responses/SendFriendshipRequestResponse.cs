namespace AFBack.Features.Friendship.DTOs.Responses;

/// <summary>
/// Response fra SendFriendshipRequest. Inneholder enten en sendt forespørsel
/// eller et auto-akseptert vennskap hvis mottaker allerede hadde sendt/avslått forespørsel
/// </summary>
public class SendFriendshipRequestResponse
{
    public bool IsAccepted { get; set; }
    public FriendshipAcceptedResponse? FriendshipAccepted { get; set; }
}
