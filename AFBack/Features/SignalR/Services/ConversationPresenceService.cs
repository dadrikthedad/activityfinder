using AFBack.Features.SignalR.Constants;
using StackExchange.Redis;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Tracker hvilke brukere som er aktive i hvilke samtaler ved hjelp av Redis Sets.
/// Bruker to-veis mapping for effektive oppslag begge veier.
/// </summary>
public class ConversationPresenceService(
    IConnectionMultiplexer redis,
    ILogger<ConversationPresenceService> logger)
    : IConversationPresenceService
{
    

    /// <inheritdoc />
    public async Task JoinConversationAsync(string userId, int conversationId)
    {
        try
        {
            var db = redis.GetDatabase();
            var conversationKey = GetConversationKey(conversationId);
            var userKey = GetUserKey(userId);

            // Legg til bruker i conversation set og conversation i user set
            await Task.WhenAll(
                db.SetAddAsync(conversationKey, userId),
                db.SetAddAsync(userKey, conversationId)
            );

            logger.LogDebug("User {UserId} joined conversation {ConversationId}", userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add user {UserId} to conversation {ConversationId}", 
                userId, conversationId);
        }
    }

    /// <inheritdoc />
    public async Task LeaveConversationAsync(string userId, int conversationId)
    {
        try
        {
            var db = redis.GetDatabase();
            var conversationKey = GetConversationKey(conversationId);
            var userKey = GetUserKey(userId);

            // Fjern bruker fra conversation set og conversation fra user set
            await Task.WhenAll(
                db.SetRemoveAsync(conversationKey, userId),
                db.SetRemoveAsync(userKey, conversationId)
            );

            logger.LogDebug("User {UserId} left conversation {ConversationId}", userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to remove user {UserId} from conversation {ConversationId}", 
                userId, conversationId);
        }
    }

    /// <inheritdoc />
    public async Task LeaveAllConversationsAsync(string userId)
    {
        try
        {
            var db = redis.GetDatabase();
            var userKey = GetUserKey(userId);

            // Hent alle samtaler brukeren er i
            var conversationIds = await db.SetMembersAsync(userKey);

            if (conversationIds.Length == 0)
                return;

            // Fjern bruker fra alle conversation sets
            var removeTasks = conversationIds.Select(convId =>
            {
                var conversationKey = GetConversationKey((int)convId);
                return db.SetRemoveAsync(conversationKey, userId);
            });

            await Task.WhenAll(removeTasks);

            // Slett brukerens conversation set
            await db.KeyDeleteAsync(userKey);

            logger.LogDebug("User {UserId} left all {Count} conversations", userId, conversationIds.Length);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to remove user {UserId} from all conversations", userId);
        }
    }

    /// <inheritdoc />
    public async Task<bool> IsUserInConversationAsync(string userId, int conversationId)
    {
        try
        {
            var db = redis.GetDatabase();
            var conversationKey = GetConversationKey(conversationId);
            return await db.SetContainsAsync(conversationKey, userId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to check if user {UserId} is in conversation {ConversationId}", 
                userId, conversationId);
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<List<string>> GetActiveUsersInConversationAsync(int conversationId)
    {
        try
        {
            var db = redis.GetDatabase();
            var conversationKey = GetConversationKey(conversationId);
            var members = await db.SetMembersAsync(conversationKey);
            return members.Select(m => m.ToString()).ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get active users in conversation {ConversationId}", conversationId);
            return [];
        }
    }

    /// <inheritdoc />
    public async Task<List<int>> GetUserActiveConversationsAsync(string userId)
    {
        try
        {
            var db = redis.GetDatabase();
            var userKey = GetUserKey(userId);
            var members = await db.SetMembersAsync(userKey);
            return members.Select(m => (int)m).ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get active conversations for user {UserId}", userId);
            return [];
        }
    }

    private static string GetConversationKey(int conversationId) 
        => string.Format(HubConstants.ConversationUsersKeyPattern, conversationId);

    private static string GetUserKey(string userId) 
        => string.Format(HubConstants.UserConversationsKeyPattern, userId);
}
