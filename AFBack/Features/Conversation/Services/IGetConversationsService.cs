using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Conversation.Services;

public interface IGetConversationsService
{
    /// <summary>
    /// Henter kun en samtale med innsendt userId og conversationId. Kan brukes til å hente alle typer samtaler
    /// ved signalr, sync, oppretting etc
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente samtaler til</param>
    /// <param name="conversationId">Samtalen vi skal hente</param>
    /// <param name="ct"></param>
    /// <returns>ConversationResponse eller NotFound/Forbidden</returns>
    Task<Result<ConversationResponse>> GetConversationAsync(string userId, int conversationId,
        CancellationToken ct = default);

    /// <summary>
    /// Henter aktive samtaler - samtaler brukeren selv har akseptert/opprettet. 1v1, pending og gruppe
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <param name="ct"></param>
    /// <returns>Result med ConversationsResponse</returns>
    Task<Result<ConversationsResponse>> GetActiveConversationsAsync(string userId, PaginationRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Henter pending samtaler - samtaler brukeren selv har mottatt en conversationrequest.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <param name="ct"></param>
    /// <returns>Result med ConversationsResponse</returns>
    Task<Result<ConversationsResponse>> GetPendingConversationsAsync(string userId, PaginationRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Henter arkiverte samtaler - samtaler brukeren selv har arkivert.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <param name="ct"></param>
    /// <returns>Result med ConversationsResponse</returns>
    Task<Result<ConversationsResponse>> GetArchivedConversationsAsync(string userId, PaginationRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Henter rejecta samtaler - samtaler brukeren selv har avslått.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <param name="ct"></param>
    /// <returns>Result med ConversationsResponse</returns>
    Task<Result<ConversationsResponse>> GetRejectedConversationsAsync(string userId, PaginationRequest request,
        CancellationToken ct = default);
}
