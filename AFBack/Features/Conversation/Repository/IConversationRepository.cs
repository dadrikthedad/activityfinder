using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Messaging.Models;


namespace AFBack.Features.Conversation.Repository;

public interface IConversationRepository
{
    
    ////////////////////////////////////////////// GET SINGLE CONVERSATION ////////////////////////////////////////////
    /// <summary>
    /// Henter en samtale med participants inkludert - uten tracking
    /// </summary>
    /// <param name="conversationId">Samtalen vi skal hente til</param>
    /// <returns>Conversation</returns>
    Task<Models.Conversation?> GetConversationAsync(int conversationId);
    
    /// <summary>
    /// Henter en samtale med participants inkludert - med tracking
    /// </summary>
    /// <param name="conversationId">Samtalen vi skal hente til</param>
    /// <returns>Conversation</returns>
    Task<Models.Conversation?> GetConversationWithTrackingAsync(int conversationId);
    
    /// <summary>
    /// Brukes for å hente ut en DTO for å hente ut nødvendige egenskaper for raskest mulig response.
    /// Henter ut via Conversation
    /// </summary>
    /// <param name="conversationId">Samtalen</param>
    /// <returns>ConversationDto eller null</returns>
    Task<ConversationDto?> GetConversationDtoAsync(int conversationId);
    
    
    /// <summary>
    /// Sjekker om det eksisterer en 1-1 samtale mellom to brukere som ikke er en gruppesamtale (Direct eller pending)
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="receiverId">Bruker B</param>
    /// <returns>Samtalen som en Conversation-entitet med Participants eller null</returns>
    Task<ConversationDto?> GetConversationBetweenUsersAsync(string userId, string receiverId);
    
    /// <summary>
    /// Henter ID til en pending samtale mellom to brukere, hvis den finnes. Brukes ved godkjennelse av vennskap
    /// </summary>
    /// <param name="userId">Bruker A</param>
    /// <param name="otherUserId">Bruker B</param>
    /// <returns>ID-en til samtalen eller null</returns>
    Task<int?> GetPendingConversationIdBetweenUsersAsync(string userId, string otherUserId);
    
    ////////////////////////////////////////////// GET MANY CONVERSATIONS /////////////////////////////////////////////
    
    /// <summary>
    /// Henter alle aktive samtaler for en bruker (Samtaler som er akseptert av brukeren ) - Dette inkluderer 1v1,
    /// gruppe og pending som brukeren har sendt ut
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="page">Siden som skal hentes</param>
    /// <param name="pageSize">Hvor mange sider å hente</param>
    /// <returns>En liste med ConversationDTo med ParticipantsDto</returns>
    Task<List<ConversationDto>> GetActiveConversationsAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller alle aktive samtaler for en bruker (Samtaler som er akseptert av brukeren ) - Dette inkluderer 1v1,
    /// gruppe og pending som brukeren har sendt ut
    /// </summary>
    /// <param name="userId">Brukeren vi teller for</param>
    /// <returns>Totalt ntall samtaler som finnes for denne brukeren</returns>
    Task<int> GetActiveConversationsCountAsync(string userId);
    
    /// <summary>
    /// Henter alle pending samtaler for en bruker (Samtaler hvor brukeren har pending status) - Dette inkluderer 1v1
    /// og gruppesamtaler
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="page">Siden som skal hentes</param>
    /// <param name="pageSize">Hvor mange sider å hente</param>
    /// <returns>En liste med ConversationDTo med ParticipantsDto</returns>
    Task<List<ConversationDto>> GetPendingConversationsAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller alle pending samtaler for en bruker (Samtaler hvor brukeren har pending status) - DDette inkluderer 1v1
    /// og gruppesamtaler
    /// </summary>
    /// <param name="userId">Brukeren vi teller for</param>
    /// <returns>Totalt ntall samtaler som finnes for denne brukeren</returns>
    Task<int> GetPendingConversationsCountAsync(string userId);
    
    
    /// <summary>
    /// Henter alle arkiverte samtaler for en bruker (Samtaler som er akseptert av brukeren og aktivert)
    /// Dette inkluderer 1v1, gruppe og pending som brukeren har akseptert
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="page">Siden som skal hentes</param>
    /// <param name="pageSize">Hvor mange sider å hente</param>
    /// <returns>En liste med ConversationDTo med ParticipantsDto</returns>
    Task<List<ConversationDto>> GetArchivedConversationsAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller alle arkiverte samtaler for en bruker (Samtaler som er akseptert av brukeren og aktivert)
    /// Dette inkluderer 1v1, gruppe og pending som brukeren har akseptert
    /// </summary>
    /// <param name="userId">Brukeren vi teller for</param>
    /// <returns>Totalt ntall samtaler som finnes for denne brukeren</returns>
    Task<int> GetArchivedConversationsCountAsync(string userId);
    
    /// <summary>
    /// Henter alle avslåtte samtaler for en bruker (Samtaler som brukeren har avslått/rejected)
    /// Dette inkluderer 1v1 og gruppesamtaler
    /// </summary>
    /// <param name="userId">Brukeren som henter samtaler</param>
    /// <param name="page">Siden som skal hentes</param>
    /// <param name="pageSize">Hvor mange sider å hente</param>
    /// <returns>En liste med ConversationDTo med ParticipantsDto</returns>
    Task<List<ConversationDto>> GetRejectedConversationsAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller alle avslåtte samtaler for en bruker (Samtaler som brukeren har avslått/rejected)
    /// Dette inkluderer 1v1 og gruppesamtaler
    /// </summary>
    /// <param name="userId">Brukeren vi teller for</param>
    /// <returns>Totalt ntall samtaler som finnes for denne brukeren</returns>
    Task<int> GetRejectedConversationsCountAsync(string userId);

    /// <summary>
    /// Henter alle unike bruker-IDer som er i en samtale med brukeren.
    /// Inkluderer både Accepted og Pending participants
    /// </summary>
    /// <param name="userId">Brukeren vi skal hente samtalepartnere for</param>
    /// <returns>En liste med ID-er</returns>
    Task<List<string>> GetAllConversationPartnerIdsAsync(string userId);
    
    ////////////////////////////////////////////// SEARCH CONVERSATIONS /////////////////////////////////////////////
    
    /// <summary>
    /// Her henter vi totalt antall samtaler for paginering på søk. Vi filterer bort slettede og rejecta samtaler
    /// og bruker en extensionsmetode for å sjekke om søkekriteriene stemmer med gruppenavn eller brukernavn
    /// </summary>
    /// <param name="userId">Brukeren sine samtaler</param>
    /// <param name="searchQuery">En string med søketekst</param>
    /// <returns>Antall samtaler som int</returns> 
    Task<int> GetTotalConversationsBySearch(string userId, string searchQuery);

    /// <summary>
    /// Her henter vi alle samtaler via søk. Vi filterer bort slettede og rejecta samtaler og bruker
    /// en extensionsmetode for å sjekke om søkekriteriene stemmer med gruppenavn eller brukernavn
    /// </summary>
    /// <param name="userId">Brukeren sine samtaler vi skal hente</param>
    /// <param name="searchQuery">Søkerkriteriet</param>
    /// <param name="page">Hvilken side vi er på</param>
    /// <param name="pageSize">Hvor mange vi skal hente</param>
    /// <returns>Liste med ConversationDto</returns>v
    Task<List<ConversationDto>> GetConversationDtosBySearch(string userId, string searchQuery,
        int page, int pageSize);

    
    ////////////////////////////////////////////// CREATE CONVERSATIONS /////////////////////////////////////////////

    /// <summary>
    /// Oppretter en Conversation med ConverationParticipants med rollback hvis noe går galt.
    /// For 1-1 samtaler sendes første melding med. For gruppesamtaler opprettes kun samtalen.
    /// </summary>
    /// <param name="conversation">Samtale-objektet som skal lages (kun type er forskjellig)</param>
    /// <param name="participants">Participants vi legger til (uten ID, men vi mapper det i metoden)</param>
    /// <param name="message">Første melding sendt i samtalen (valgfri for gruppesamtaler)</param>
    /// <returns>Conversation med ID og ConversationParticipants med ID-er</returns>
    Task<Models.Conversation> CreateConversationWithParticipantsAsync(Models.Conversation conversation,
        List<ConversationParticipant> participants, Message? message = null);
    
    ////////////////////////////////////////////// UPDATE CONVERSATIONS /////////////////////////////////////////////
    /// 
    /// <summary>
    /// Lagrer en samtale
    /// </summary>
    Task SaveChangesAsync();
    
    /// <summary>
    /// Oppdaterer en Conversation sin lastMessageSentAt
    /// </summary>
    /// <param name="conversationId">Samtalen som skal oppdateres</param>
    /// <param name="sentAt">Ny tid</param>
    Task UpdateLastMessageSentAt(int conversationId, DateTime sentAt);
    
    ////////////////////////////////////////////// DELETE CONVERSATIONS /////////////////////////////////////////////

    /// <summary>
    /// Henter og sletter en samtale
    /// </summary>
    /// <param name="conversation">Samtalen som skal slettes</param>
    Task DeleteConversationAsync(Models.Conversation conversation);
    
    ////////////////////////////////////////////// PARTICIPANT OPERATIONS /////////////////////////////////////////////
    
    /// <summary>
    /// Henter en participant basert på composite primary key.
    /// </summary>
    /// <param name="userId">Brukeren som er participant</param>
    /// <param name="conversationId">Samtalen brukeren er participant i</param>
    /// <returns>ConversationParticipant hvis den finnes, null ellers</returns>
    Task<ConversationParticipant?> GetParticipantAsync(string userId, int conversationId);

    /// <summary>
    /// Fjerner en participant fra en samtale. Brukes når en bruker forlater eller avslår en gruppesamtale.
    /// </summary>
    /// <param name="participant">Brukeren som skal bli fjernet</param>
    /// <returns>True hvis participant ble fjernet, false hvis den ikke fantes</returns>
    Task RemoveParticipantAsync(ConversationParticipant participant);
    
    /// <summary>
    /// Returnerer hvilke av de gitte samtale-IDene brukeren har Accepted status i.
    /// Optimalisert for batch-validering av tilgang.
    /// </summary>
    /// <param name="userId">Brukeren som skal sjekkes</param>
    /// <param name="conversationIds">Liste med samtale-IDer å sjekke</param>
    /// <returns>HashSet med samtale-IDer brukeren har tilgang til</returns>
    Task<HashSet<int>> GetUserAcceptedConversationIdsAsync(string userId, List<int> conversationIds);
    
    
    /// <summary>
    /// Henter den eldste inviterte brukeren med Accepted status i en gruppesamtale (etter creator).
    /// Brukes for å overføre Creator-rollen når creator forlater.
    /// Sorterer etter InvitedAt ascending og tar første som ikke er excludeUserId.
    /// </summary>
    /// <param name="conversationId">Samtalen å søke i</param>
    /// <param name="excludeUserId">Brukeren som skal ekskluderes (creator som forlater)</param>
    /// <returns>ConversationParticipant hvis kandidat finnes, null ellers</returns>
    Task<ConversationParticipant?> GetNextCreatorCandidateAsync(int conversationId, string excludeUserId);
}
