using AFBack.Features.Conversation.Models;

namespace AFBack.Features.Conversation.Repository;

public interface IConversationLeftRecordRepository
{
    /// <summary>
    /// Sjekker om det eksisterer en ConversationLeftRecord for en bruker i en samtale.
    /// Brukes for å hindre re-invitasjon til grupper brukeren har forlatt/avslått.
    /// </summary>
    /// <param name="userId">Brukeren som skal sjekkes</param>
    /// <param name="conversationId">Samtalen som skal sjekkes</param>
    /// <returns>True hvis record eksisterer, false ellers</returns>
    Task<bool> ExistsAsync(string userId, int conversationId);
    
    /// <summary>
    /// Henter en ConversationLeftRecord basert på composite primary key.
    /// </summary>
    /// <param name="userId">Brukeren som har forlatt/avslått samtalen</param>
    /// <param name="conversationId">Samtalen som ble forlatt/avslått</param>
    /// <returns>ConversationLeftRecord hvis den finnes, null ellers</returns>
    Task<ConversationLeftRecord?> GetAsync(string userId, int conversationId);

    
    /// <summary>
    /// Henter alle ConversationLeftRecords for en bruker.
    /// Brukes for å vise grupper brukeren har forlatt og kan bli med i igjen.
    /// </summary>
    /// <param name="userId">Brukeren som skal hentes records for</param>
    /// <returns>Liste med ConversationLeftRecords</returns>
    Task<List<ConversationLeftRecord>> GetByUserIdAsync(string userId);
    
    /// <summary>
    /// Henter ConversationLeftRecords for en bruker med paginering.
    /// Inkluderer Conversation for å kunne vise gruppenavn og bilde.
    /// </summary>
    /// <param name="userId">Brukeren som skal hentes records for</param>
    /// <param name="page">Sidenummer (1-indeksert)</param>
    /// <param name="pageSize">Antall per side</param>
    /// <returns>Liste med ConversationLeftRecords</returns>
    Task<List<ConversationLeftRecord>> GetByUserIdPaginatedAsync(string userId, int page, int pageSize);
    
    /// <summary>
    /// Teller antall ConversationLeftRecords for en bruker.
    /// </summary>
    /// <param name="userId">Brukeren som skal telles records for</param>
    /// <returns>Antall records</returns>
    Task<int> GetCountByUserIdAsync(string userId);
    
    /// <summary>
    /// Oppretter en ConversationLeftRecord når en bruker forlater eller avslår en gruppesamtale.
    /// </summary>
    /// <param name="record">ConversationLeftRecord som skal opprettes</param>
    Task CreateAsync(ConversationLeftRecord record);


    /// <summary>
    /// Sletter en ConversationLeftRecord for å tillate at brukeren kan bli invitert på nytt.
    /// </summary>
    /// <param name="record">Recorden som skal bli slettet</param>
    Task DeleteAsync(ConversationLeftRecord record);
    
    /// <summary>
    /// Sletter alle ConversationLeftRecords for en samtale.
    /// Brukes når en gruppe blir disbanded.
    /// </summary>
    /// <param name="conversationId">Samtalen som skal slettes records for</param>
    /// <returns>Antall slettede records</returns>
    Task<int> DeleteAllByConversationIdAsync(int conversationId);
}
