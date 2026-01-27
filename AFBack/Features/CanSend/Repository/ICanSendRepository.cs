namespace AFBack.Features.CanSend.Repository;

public interface ICanSendRepository
{
    /// <summary>
    /// Sjekker raskt om brukeren og samtalen er i CanSend
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="conversationId"></param>
    /// <returns>True hvis brukeren er i CanSend, false hvis ikke</returns>
    Task<bool> CanSendExistsAsync(string userId, int conversationId);
    
    /// <summary>
    /// Henter alle bruker-IDer som har CanSend for en samtale.
    /// Brukes for å invalidere cache når en gruppe disbandes.
    /// </summary>
    /// <param name="conversationId">Samtalen som skal hentes bruker-IDer for</param>
    /// <returns>Liste med bruker-IDer</returns>
    Task<List<string>> GetUserIdsByConversationIdAsync(int conversationId);
    
    /// <summary>
    /// Legger til en CandSend i databasen
    /// </summary>
    /// <param name="canSend">Oppretter en CanSend i databasen</param>
    /// <returns></returns>
    Task AddAsync(Models.CanSend canSend);
    
    /// <summary>
    /// Fjerner en CanSend fra databasen
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="conversationId"></param>
    /// <returns></returns>
    Task RemoveAsync(string userId, int conversationId);
    
    
}
