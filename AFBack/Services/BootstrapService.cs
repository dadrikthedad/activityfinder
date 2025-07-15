using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using AFBack.DTOs.BoostrapDTO;
using Microsoft.EntityFrameworkCore;
using AFBack.Extensions;

namespace AFBack.Services
{
    public class BootstrapService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<BootstrapService> _logger;
        private readonly ConversationService _conversationService;
        private readonly IServiceProvider _serviceProvider;
        private readonly MessageService _messageService;

        public BootstrapService(ApplicationDbContext context, ILogger<BootstrapService> logger,
            ConversationService conversationService, IServiceProvider serviceProvider, MessageService messageService)
        {
            _context = context;
            _logger = logger;
            _conversationService = conversationService;
            _serviceProvider = serviceProvider;
            _messageService = messageService;
        }

        public async Task<CriticalBootstrapResponseDTO> GetCriticalBootstrapAsync(int userId)
        {
            try
            {
                _logger.LogInformation("🚀 Starting parallel critical bootstrap for userId: {UserId}", userId);

                // ✅ PARALLEL: Separate scopes for hver operasjon
                var userTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Starting user lookup with separate context");
                    return await GetCurrentUserWithContext(userId, context);
                });

                var conversationsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var conversationService = scope.ServiceProvider.GetRequiredService<ConversationService>();
                    _logger.LogDebug("📋 Starting conversations lookup with separate service");
                    return await GetConversationsWithService(userId, 10, conversationService);
                });

                _logger.LogInformation("📋 Waiting for parallel tasks to complete...");
                await Task.WhenAll(userTask, conversationsTask);

                var user = await userTask;
                var conversations = await conversationsTask;

                _logger.LogInformation("📋 Creating response...");
                var response = new CriticalBootstrapResponseDTO
                {
                    User = user.ToUserSummaryDTO(),
                    RecentConversations = conversations,
                    SyncToken = GenerateSimpleSyncToken(userId, user.IsOnline)
                };

                _logger.LogInformation("✅ Parallel critical bootstrap completed for user: {UserName}", user.FullName);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get critical bootstrap for user {UserId}", userId);
                throw;
            }
        }

        public async Task<SecondaryBootstrapResponseDTO> GetSecondaryBootstrapAsync(int userId)
        {
            try
            {
                _logger.LogInformation("📚 Starting parallel secondary bootstrap for userId: {UserId}", userId);

                // ✅ PARALLEL: Separate scopes for hver operasjon
                var settingsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Getting settings with separate context");
                    return await GetUserSettingsWithContext(userId, context);
                });

                var friendsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Getting friends with separate context");
                    return await GetUserFriendsWithContext(userId, context);
                });

                var blockedUsersTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Getting blocked users with separate context");
                    return await GetBlockedUsersWithContext(userId, context);
                });

                var unreadConversationsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Getting unread conversation IDs with separate context");
                    return await GetUnreadConversationIdsWithContext(userId, context);
                });

                // 🆕 LEGG TIL PENDING MESSAGE REQUESTS TASK
                var pendingRequestsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var messageService = scope.ServiceProvider.GetRequiredService<MessageService>();
                    _logger.LogDebug("📋 Getting pending message requests with separate service");
                    return await GetPendingMessageRequestsWithService(userId, messageService);
                });

                _logger.LogInformation("📋 Waiting for parallel secondary tasks to complete...");
                await Task.WhenAll(settingsTask, friendsTask, blockedUsersTask, unreadConversationsTask, pendingRequestsTask);

                var settings = await settingsTask;
                var friends = await friendsTask;
                var blockedUsers = await blockedUsersTask;
                var unreadConversationIds = await unreadConversationsTask;
                var pendingRequests = await pendingRequestsTask; // 🆕

                _logger.LogInformation("📋 Creating secondary response...");
                var response = new SecondaryBootstrapResponseDTO
                {
                    Settings = settings.ToUserSettingsDTO(),
                    Friends = friends.ToUserSummaryDTOsSafe(),
                    BlockedUsers = blockedUsers.ToUserSummaryDTOsSafe(),
                    UnreadConversationIds = unreadConversationIds,
                    PendingMessageRequests = pendingRequests // 🆕
                };

                _logger.LogInformation(
                    "✅ Parallel secondary bootstrap completed - Friends: {FriendCount}, Blocked: {BlockedCount}, Unread: {UnreadCount}, Pending: {PendingCount}",
                    friends.Count, blockedUsers.Count, unreadConversationIds.Count, pendingRequests.Count);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get secondary bootstrap for user {UserId}", userId);
                throw;
            }
        }
        
        // PRIMARY ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // ✅ SEPARATE METHODS MED EGNE CONTEXTS

        private async Task<User> GetCurrentUserWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Looking up user with ID: {UserId} (separate context)", userId);

            var user = await context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                _logger.LogWarning("⚠️ User with ID {UserId} not found", userId);
                throw new KeyNotFoundException($"User with ID {userId} not found");
            }

            _logger.LogDebug("✅ User found: {UserName}", user.FullName);

            // Oppdater LastSeen når brukeren starter appen
            user.LastSeen = DateTime.UtcNow;
            await context.SaveChangesAsync();

            return user;
        }

        private async Task<List<ConversationDTO>> GetConversationsWithService(int userId, int limit,
            ConversationService conversationService)
        {
            _logger.LogDebug("🔍 Getting {Limit} recent conversations for user {UserId} (separate service)", limit,
                userId);

            var conversationResults = await conversationService.GetUserConversationsSortedAsync(
                userId,
                includeRejected: false,
                limit: limit);

            _logger.LogDebug("✅ Found {ConversationCount} conversations", conversationResults.Count);

            return conversationResults
                .Select(c => new ConversationDTO
                {
                    Id = c.Conversation.Id,
                    GroupName = c.Conversation.GroupName,
                    IsGroup = c.Conversation.IsGroup,
                    GroupImageUrl = c.Conversation.GroupImageUrl,
                    CreatorId = c.Conversation.CreatorId,
                    IsApproved = c.Conversation.IsApproved,
                    LastMessageSentAt = c.Conversation.LastMessageSentAt,
                    IsPendingApproval = c.IsPendingApproval,
                    Disbanded = c.Conversation.IsDisbanded,
                    DisbandedAt = c.Conversation.DisbandedAt,
                    Participants = c.Conversation.Participants.Select(p => new UserSummaryDTO
                    {
                        Id = p.User.Id,
                        FullName = p.User.FullName,
                        ProfileImageUrl = p.User.Profile?.ProfileImageUrl,
                        GroupRequestStatus = !c.Conversation.IsGroup ? null :
                            p.User.Id == c.Conversation.CreatorId ? GroupRequestStatus.Creator :
                            c.GroupRequestLookup.TryGetValue(p.User.Id, out var status) ? status :
                            null
                    }).ToList()
                })
                .ToList();
        }
        
        // SECONDARY ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private async Task<UserSettings?> GetUserSettingsWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting settings for user {UserId} (separate context)", userId);

            var settings = await context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            _logger.LogDebug("✅ Settings found: {HasSettings}", settings != null);
            return settings;
        }

        private async Task<List<User>> GetUserFriendsWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting friends for user {UserId} (separate context)", userId);
    
            // Hent venner hvor brukeren er UserId (User → Friend)
            var friendsAsUser = context.Friends
                .Where(f => f.UserId == userId)
                .Include(f => f.FriendUser)
                .ThenInclude(u => u.Profile)
                .Select(f => f.FriendUser);

            // Hent venner hvor brukeren er FriendId (Friend → User)  
            var friendsAsFriend = context.Friends
                .Where(f => f.FriendId == userId)
                .Include(f => f.User)
                .ThenInclude(u => u.Profile)
                .Select(f => f.User);

            // Kombiner begge lister og fjern duplikater
            var allFriends = await friendsAsUser
                .Union(friendsAsFriend)
                .Distinct()
                .ToListAsync();

            _logger.LogDebug("✅ Found {FriendCount} friends", allFriends.Count);
            return allFriends;
        }

        private async Task<List<User>> GetBlockedUsersWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting blocked users for user {UserId} (separate context)", userId);

            var blockedByUser = context.UserBlock
                .Where(ub => ub.BlockerId == userId)
                .Include(ub => ub.BlockedUser)
                .ThenInclude(u => u.Profile)
                .Select(ub => ub.BlockedUser);

            var blockedUser = context.UserBlock
                .Where(ub => ub.BlockedUserId == userId)
                .Include(ub => ub.Blocker)
                .ThenInclude(u => u.Profile)
                .Select(ub => ub.Blocker);

            var allBlockedUsers = await blockedByUser
                .Union(blockedUser)
                .Distinct()
                .ToListAsync();

            _logger.LogDebug("✅ Found {BlockedCount} blocked users", allBlockedUsers.Count);
            return allBlockedUsers;
        }
        
        private async Task<List<int>> GetUnreadConversationIdsWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting unread conversation IDs for user {UserId} (separate context)", userId);

            var unreadConvIds = await context.MessageNotifications
                .Where(n => n.UserId == userId && !n.IsRead && n.ConversationId != null)
                .Select(n => n.ConversationId!.Value)
                .Distinct()
                .ToListAsync();

            _logger.LogDebug("✅ Found {UnreadCount} unread conversations", unreadConvIds.Count);
            return unreadConvIds;
        }
        
        private async Task<List<MessageRequestDTO>> GetPendingMessageRequestsWithService(int userId, MessageService messageService)
        {
            _logger.LogDebug("🔍 Getting pending message requests for user {UserId} (separate service)", userId);

            try
            {
                var pendingRequests = await messageService.GetPendingMessageRequestsAsync(userId);
                _logger.LogDebug("✅ Found {PendingCount} pending message requests", pendingRequests.Count);
                return pendingRequests;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get pending message requests for user {UserId}", userId);
                // Returner tom liste istedenfor å krasje bootstrap
                return new List<MessageRequestDTO>();
            }
        }

        // SYNC ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        private string GenerateSimpleSyncToken(int userId, bool isOnline)
        {
            var token = new
            {
                userId = userId,
                timestamp = DateTime.UtcNow.ToString("O"),
                version = 1,
                isOnline = isOnline
            };

            var json = System.Text.Json.JsonSerializer.Serialize(token);
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json));
        }
    }
}