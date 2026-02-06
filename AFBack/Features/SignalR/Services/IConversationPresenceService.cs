namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Service for å tracke hvilke brukere som er aktive i hvilke samtaler.
/// Bruker Redis Sets for skalerbarhet på tvers av servere.
/// </summary>
public interface IConversationPresenceService
{
    /// <summary>
    /// Registrerer at en bruker har åpnet/er aktiv i en samtale.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <param name="conversationId">Samtale-ID</param>
    Task JoinConversationAsync(string userId, int conversationId);

    /// <summary>
    /// Registrerer at en bruker har lukket/forlatt en samtale.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <param name="conversationId">Samtale-ID</param>
    Task LeaveConversationAsync(string userId, int conversationId);

    /// <summary>
    /// Fjerner bruker fra alle samtaler. Kalles ved disconnect.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    Task LeaveAllConversationsAsync(string userId);

    /// <summary>
    /// Sjekker om en bruker er aktiv i en samtale.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <param name="conversationId">Samtale-ID</param>
    /// <returns>true hvis bruker er aktiv i samtalen</returns>
    Task<bool> IsUserInConversationAsync(string userId, int conversationId);

    /// <summary>
    /// Henter alle brukere som er aktive i en samtale.
    /// </summary>
    /// <param name="conversationId">Samtale-ID</param>
    /// <returns>Liste med bruker-IDer</returns>
    Task<List<string>> GetActiveUsersInConversationAsync(int conversationId);

    /// <summary>
    /// Henter alle samtaler en bruker er aktiv i.
    /// </summary>
    /// <param name="userId">Bruker-ID</param>
    /// <returns>Liste med samtale-IDer</returns>
    Task<List<int>> GetUserActiveConversationsAsync(string userId);
}
