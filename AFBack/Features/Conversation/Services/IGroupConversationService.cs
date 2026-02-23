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
    
    /// <summary>
    /// Forlater en gruppesamtale. Brukeren må ha Accepted status. Oppretter en ConversationLeftRecord
    /// for å hindre re-invitasjon, fjerner brukeren fra Participants, sender systemmelding om at brukeren
    /// forlot gruppen, og notifiserer gjenstående medlemmer via SignalR og SyncEvents.
    /// </summary>
    /// <param name="userId">Brukeren som forlater gruppen (må ha Accepted status)</param>
    /// <param name="conversationId">Gruppesamtalen som forlates</param>
    /// <returns>Result uten data (NoContent)</returns>
    Task<Result> LeaveGroupConversationAsync(string userId, int conversationId);
    
    /// <summary>
    /// Henter alle grupper brukeren har forlatt/avslått med paginering.
    /// Brukes for å vise en liste over grupper brukeren kan bli med i igjen.
    /// </summary>
    /// <param name="userId">Brukeren som skal hentes records for</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>ConversationLeftRecordsResponse med paginert liste</returns>
    Task<Result<ConversationLeftRecordsResponse>> GetLeftConversationsAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Sletter en ConversationLeftRecord slik at brukeren kan bli invitert på nytt til gruppen.
    /// </summary>
    /// <param name="userId">Brukeren som ønsker å fjerne recorden</param>
    /// <param name="conversationId">Samtalen recorden tilhører</param>
    /// <returns>Result uten data (NoContent)</returns>
    Task<Result> DeleteLeftConversationRecordAsync(string userId, int conversationId);
    
    // ======================== Oppdatere gruppe ======================== 
    // ======================== Bytte gruppenavn ======================== 
    
    /// <summary>
    /// Oppdaterer gruppenavnet. Kun Creator har tilgang til dette.
    /// Sender systemmelding, SignalR, Notification og SyncEvent til alle deltakere (Accepted og Pending).
    /// </summary>
    /// <param name="userId">Brukeren som oppdaterer navnet (må være Creator)</param>
    /// <param name="conversationId">Gruppesamtalen som oppdateres</param>
    /// <param name="groupName">String med nytt gruppenavn</param>
    /// <returns>ConversationResponse med oppdatert samtale</returns>
    Task<Result<ConversationResponse>> UpdateGroupNameAsync(
        string userId, int conversationId, string groupName);
    
    // ======================== Bytte gruppebilde ========================
    /// <summary>
    /// Oppdaterer gruppebilde. Kun Creator har tilgang til dette.
    /// Sender systemmelding, SignalR, Notification og SyncEvent til alle deltakere (Accepted og Pending).
    /// </summary>
    /// <param name="userId">Brukeren som oppdaterer navnet (må være Creator)</param>
    /// <param name="conversationId">Gruppesamtalen som oppdateres</param>
    /// <param name="image">Gruppebilde som en IFormFile</param>
    /// <returns>ConversationResponse med oppdatert samtale</returns>
    Task<Result<ConversationResponse>> UpdateGroupImageAsync(string userId, int conversationId,
        IFormFile image);
    
    /// <summary>
    /// Fjerner gruppebildet. Kun Creator har tilgang til dette.
    /// Sletter bildet fra storage, nullstiller URL i databasen,
    /// sender systemmelding, SignalR, Notification og SyncEvent til alle deltakere (Accepted og Pending).
    /// </summary>
    /// <param name="userId">Brukeren som fjerner bildet (må være Creator)</param>
    /// <param name="conversationId">Gruppesamtalen som oppdateres</param>
    /// <returns>ConversationResponse med oppdatert samtale</returns>
    Task<Result<ConversationResponse>> RemoveGroupImageAsync(string userId, int conversationId);
    
    // ======================== Bytte groupdescription ========================
    /// <summary>
    /// Oppdaterer gruppebeskrivelsen. Kun Creator har tilgang til dette.
    /// Sender systemmelding, SignalR, Notification og SyncEvent til alle deltakere (Accepted og Pending).
    /// </summary>
    /// <param name="userId">Brukeren som oppdaterer beskrivelsen (må være Creator)</param>
    /// <param name="conversationId">Gruppesamtalen som oppdateres</param>
    /// <param name="groupDescription">Ny gruppebeskrivelse, eller null for å fjerne</param>
    /// <returns>ConversationResponse med oppdatert samtale</returns>
    Task<Result<ConversationResponse>> UpdateGroupDescriptionAsync(
        string userId, int conversationId, string? groupDescription);
}
