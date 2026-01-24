using AFBack.Common.DTOs;
using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs;

namespace AFBack.Features.Conversation.Services;

public interface INewConversationService
{
    /// <summary>
    /// Henter kun en samtale med innsendt userId og conversationId. Kan brukes til å hente alle typer samtaler
    /// ved signalr, sync, oppretting etc
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente samtaler til</param>
    /// <param name="conversationId">Samtalen vi skal hente</param>
    /// <returns>ConversationResponse eller NotFound/Forbidden</returns>
    Task<Result<ConversationResponse>> GetConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Henter aktive samtaler - samtaler brukeren selv har akseptert/opprettet. 1v1, pending og gruppe
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationsResponse>> GetActiveConversationsAsync(
        string userId, PaginationRequest request);
    
    /// <summary>
    /// Henter pending samtaler - samtaler brukeren selv har mottatt en conversationrequest.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationsResponse>> GetPendingConversationsAsync(
        string userId, PaginationRequest request);
    
    /// <summary>
    /// Henter arkiverte samtaler - samtaler brukeren selv har arkivert.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationsResponse>> GetArchivedConversationsAsync(
        string userId, PaginationRequest request);

    /// <summary>
    /// Henter rejecta samtaler - samtaler brukeren selv har avslått.
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationsResponse>> GetRejectedConversationsAsync(
        string userId, PaginationRequest request);
    
    
    /// <summary>
    /// Søker etter en samtale til en bruker.. Henter ut antall samtaler først for pagineringen, deretter henter vi 
    /// ut en liste med alle samtaler som stemmer med søkeparameteret
    /// </summary>
    /// <param name="userId">Brukeren som søker</param>
    /// <param name="request">ConversationSearchRequest med søkequery, pagesize og page</param>
    /// <returns>Liste med ConversationsResponse eller tom liste</returns>
    Task<Result<ConversationsResponse>> SearchConversationsAsync(string userId,
        ConversationSearchRequest request);
    
    /// <summary>
    /// Arkiverer en brukers samtale, fjerner brukerne fra CanSend og lager en sync event til kun brukerns enheter
    /// </summary>
    /// <param name="userId">Brukerne som ønsker arkivering av samtale</param>
    /// <param name="conversationId">Samtalen som skal arkiveres</param>
    Task<Result> ArchiveConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Gjenoppretter en arkivert direct chatr samtale for en bruker. Lagrer i databasen, legger til i CanSend og
    /// lager SyncEvent for kun brukern
    /// </summary>
    /// <param name="userId">Brukeren som vil gjenopprette samtalen</param>
    /// <param name="conversationId">Samtalen</param>
    /// <returns>Result med ConversationResponse</returns>
    Task<Result<ConversationResponse>> RestoreArchivedConversationAsync(string userId, int conversationId);

    
    /// <summary>
    /// Sender en melding til en bruker for 1-1 samtaler, og håndterer både eksisterende samtaler og opprettelse
    /// av nye samtaler. Auto-aksepterer samtalen hvis avsender av melding er pending i samtalen.
    /// Er brukerne venner så opprettes en samtale, men en melding vises som vanlig for brukeren. Metoden putter
    /// brukerne i CanSend hvis begge er venner.
    /// Sender SignalR, lager MessageNotification og SyncEvent hvis samtalen blir opprettet
    /// </summary>
    /// <param name="userId">Avsender</param>
    /// <param name="request">SendMessageToUserRequest med mottaker og en kryptert tekstmelding</param>
    /// <returns>Result med SendMessageToUserResponse</returns>
    Task<Result<SendMessageToUserResponse>> SendMessageToUserAsync(string userId,
        SendMessageToUserRequest request);
}
