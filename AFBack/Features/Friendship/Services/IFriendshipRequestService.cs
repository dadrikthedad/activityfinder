using AFBack.Common.Results;
using AFBack.Features.Friendship.DTOs.Responses;

namespace AFBack.Features.Friendship.Services;

public interface IFriendshipRequestService
{
    /// <summary>
    /// Sender en venneforespørsel til en annen bruker. Validerer, oppretter og sender SignalR/SyncEvent til mottaker
    /// </summary>
    /// <param name="senderId">Senderen av forespørselen</param>
    /// <param name="receiverId">Mottaker av forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result<SendFriendshipRequestResponse>> SendFriendshipRequestAsync(string senderId, string receiverId);
    
    /// <summary>
    /// Aksepterer en venneforespørsel. Oppretter Friendship, sender SignalR/SyncEvent til begge parter
    /// </summary>
    /// <param name="accepterId">Brukeren som aksepterer</param>
    /// <param name="requestId">ID til venneforespørselen</param>
    /// <returns>Result med FriendshipAcceptedResponse eller Failure</returns>
    Task<Result<FriendshipAcceptedResponse>> AcceptFriendshipRequestAsync(string accepterId, int requestId);
    
    /// <summary>
    /// Avslår en venneforespørsel. Kun mottaker kan avslå.
    /// Avsender får ikke beskjed om avslaget (privacy).
    /// </summary>
    /// <param name="userId">Brukeren som avslår</param>
    /// <param name="requestId">ID-en til forespørselen</param>
    /// <returns>Result med Success eller Failure</returns>
    Task<Result> DeclineFriendshipRequestAsync(string userId, int requestId);
}
