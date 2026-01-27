namespace AFBack.Cache;

public interface ISendMessageCache
{
    /// <summary>
    /// Sjekker om en bruker kan sende meldinger til en samtale (med cache). Ved miss så henter fra databasen
    /// </summary>
    Task<bool> CanUserSendAsync(string userId, int conversationId);
    
    /// <summary>
    /// Adds send permission for a user in a conversation.
    /// Persists to database first, then updates cache.
    /// </summary>
    /// <param name="userId">The ID of the user to grant permission to.</param>
    /// <param name="conversationId">The ID of the conversation.</param>
    Task OnCanSendAddedAsync(string userId, int conversationId);
    
    /// <summary>
    /// Removes send permission for a user in a conversation.
    /// Deletes from database first, then invalidates cache.
    /// </summary>
    /// <param name="userId">The ID of the user to revoke permission from.</param>
    /// <param name="conversationId">The ID of the conversation.</param>
    Task OnCanSendRemovedAsync(string userId, int conversationId);

    /// <summary>
    /// Removes send permission for all users in a conversation.
    /// Fetches all users with permission, then deletes from database and invalidates cache for each.
    /// </summary>
    /// <param name="conversationId">The ID of the conversation.</param>
    Task RemoveAllUsersFromConversationAsync(int conversationId);
} 
