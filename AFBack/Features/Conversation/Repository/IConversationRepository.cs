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
    /// Første melding en bruker sender i en samtale blir lagret direkte i databasen
    /// </summary>
    /// <param name="conversation">Samtale-objektet som skal lages (kun type er forskjellig)</param>
    /// <param name="participants">Participants vi legger til (uten ID, men vi mapper det i metoden)</param>
    /// <param name="message">Første melding sendt i samtalen</param>
    /// <returns>Conversation med ID og ConversationParticipants med ID-er</returns>
    Task<Models.Conversation> CreateConversationWithParticipantsAsync(
        Models.Conversation conversation,
        List<ConversationParticipant> participants,
        Message message);
    
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
    /// <param name="conversationId">Samtalen som skal slettes</param>
    Task DeleteConversationAsync(int conversationId);
}
