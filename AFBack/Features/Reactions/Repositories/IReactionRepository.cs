using AFBack.Features.Reactions.Models;

namespace AFBack.Features.Reactions.Repositories;

public interface IReactionRepository
{
    /// <summary>
    /// Henter en eksistrende reaksjon på en melding som tilhører en samtale
    /// </summary>
    /// <param name="userId">Brukeren som vi sjekker har reagert</param>
    /// <param name="messageId">Meldingen brukeren har reagert på</param>
    /// <param name="conversationId">Samtalen meldingen skal høre toø</param>
    /// <returns>Reaction eller null</returns>
    Task<Reaction?> GetUserReactionOnMessageAsync(string userId, int messageId, int conversationId);
    
    /// <summary>
    /// Legger til en Reaction. Lagrer ikke
    /// </summary>
    /// <param name="reaction">Reaction</param>
    Task AddReactionAsync(Reaction reaction);
    
    /// <summary>
    /// Setter en reaction for sletting
    /// </summary>
    /// <param name="reaction">Reaksjonen som skal slettes</param>
    void RemoveReaction(Reaction reaction);

    Task SaveChangesAsync();
}
