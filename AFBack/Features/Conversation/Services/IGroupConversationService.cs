using AFBack.Common.Results;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;

namespace AFBack.Features.Conversation.Services;

public interface IGroupConversationService
{
    /// <summary>
    /// Oppretter en gruppesamtale med flere deltakere. Creator får Accepted status og Creator-rolle,
    /// mens inviterte brukere får Pending status og Member-rolle. Sender SignalR, SyncEvents og Notifications
    /// til alle inviterte brukere. Legger kun creator i CanSend cache (inviterte må akseptere først).
    /// </summary>
    /// <param name="userId">Brukeren som oppretter gruppen (blir Creator)</param>
    /// <param name="request">CreateGroupConversationRequest med gruppenavn, mottakere og første melding</param>
    /// <returns>CreateGroupConversationResponse med samtale og melding</returns>
    Task<Result<CreateGroupConversationResponse>> CreateGroupConversationAsync(
        string userId, CreateGroupConversationRequest request);
    
    /// <summary>
    /// Aksepterer en pending gruppeinvitasjon. Oppdaterer brukerens status til Accepted og rolle til Member,
    /// legger brukeren inn i CanSend cache, sender systemmelding om at brukeren ble med,
    /// sender SignalR til alle medlemmer med Accepted status, oppretter SyncEvents for alle medlemmer,
    /// og oppretter notifications til alle andre medlemmer.
    /// </summary>
    /// <param name="userId">Brukeren som aksepterer invitasjonen (må ha Pending status)</param>
    /// <param name="conversationId">Gruppesamtalen som aksepteres</param>
    /// <returns>ConversationResponse med oppdatert samtale</returns>
    Task<Result<ConversationResponse>> AcceptPendingGroupConversationRequestAsync(
        string userId, int conversationId);
    
    /// <summary>
    /// Avslår en pending gruppeinvitasjon. Oppretter en ConversationLeftRecord for å hindre re-invitasjon,
    /// fjerner brukeren fra Participants, og oppretter SyncEvent kun til brukerens andre enheter.
    /// Andre medlemmer får ingen notifikasjon om at invitasjonen ble avslått (privacy).
    /// </summary>
    /// <param name="userId">Brukeren som avslår invitasjonen (må ha Pending status)</param>
    /// <param name="conversationId">Gruppesamtalen som avslås</param>
    /// <returns>Result uten data (NoContent)</returns>
    Task<Result> RejectPendingGroupConversationRequestAsync(string userId, int conversationId);
    
    /// <summary>
    /// Inviterer nye brukere til en eksisterende gruppesamtale. Inviterende bruker må være medlem med
    /// Accepted status. Validerer at brukere ikke allerede er medlemmer, ikke er blokkert, og ikke har
    /// forlatt gruppen tidligere. Oppretter Participants med Pending status, sender systemmelding,
    /// og notifiserer både eksisterende medlemmer og inviterte brukere via SignalR, SyncEvents og Notifications.
    /// </summary>
    /// <param name="userId">Brukeren som inviterer (må ha Accepted status)</param>
    /// <param name="conversationId">Gruppesamtalen brukere inviteres til</param>
    /// <param name="request">InviteGroupMemberRequest med liste over brukere og KeyInfo for E2EE</param>
    /// <returns>ConversationResponse med oppdatert samtale inkludert nye inviterte brukere</returns>
    Task<Result<ConversationResponse>> InviteGroupMembersAsync(
        string userId, int conversationId, InviteGroupMemberRequest request);
}
