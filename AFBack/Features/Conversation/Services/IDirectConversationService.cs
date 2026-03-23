using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Conversation.Services;

public interface IDirectConversationService
{
    /// <summary>
    /// Sender en melding til en bruker for 1-1 samtaler, og håndterer både eksisterende samtaler og opprettelse
    /// av nye samtaler. Auto-aksepterer samtalen hvis avsender av melding er pending i samtalen.
    /// Sender SignalR, lager MessageNotification og SyncEvent hvis samtalen blir opprettet
    /// </summary>
    /// <param name="userId">Avsender</param>
    /// <param name="request">SendMessageToUserRequest med mottaker og en kryptert tekstmelding</param>
    /// <returns>Result med SendMessageToUserResponse</returns>
    Task<Result<SendMessageToUserResponse>> SendMessageToUserAsync(
        string userId, SendMessageToUserRequest request);
    
    /// <summary>
    /// Aksepterer en pending conversation request. Endrer conversation type fra PendingRequest til DirectChat,
    /// oppdaterer begge participants til Accepted status, legger begge brukere inn i CanSend cache,
    /// sender systemmelding, oppretter SyncEvent for begge brukere, sender SignalR til mottaker sine andre enheter,
    /// og oppretter notification for mottaker
    /// </summary>
    /// <param name="userId">Brukeren som har godkjent PendingConversationRequest</param>
    /// <param name="conversationId">Samtalen som ble godkjent</param>
    /// <returns>ConversationResponse til frontend for å legge rett i riktig samtale</returns>
    Task<Result<ConversationResponse>> AcceptPendingConversationRequestAsync(
        string userId, int conversationId);
    
    /// <summary>
    /// Avslår en pending conversation request. Oppdaterer brukerens participant status til Rejected.
    /// Sender ikke notifikasjon til sender - de skal ikke vite at requesten ble avslått.
    /// Oppretter SyncEvent kun for brukerens andre enheter.
    /// </summary>
    /// <param name="userId">Brukeren som avslår (må være mottaker/PendingRecipient)</param>
    /// <param name="conversationId">Samtalen som skal avslås</param>
    /// <returns>Result uten data (NoContent)</returns>
    Task<Result> RejectPendingConversationRequestAsync(string userId, int conversationId);
}
