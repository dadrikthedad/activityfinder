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
        private readonly IMessageService  _messageService;
        private readonly FriendService _friendService;
        private readonly INotificationService _notificationService;
        private readonly SyncService _syncService;

        public BootstrapService(ApplicationDbContext context, ILogger<BootstrapService> logger,
            ConversationService conversationService, IServiceProvider serviceProvider, IMessageService messageService, FriendService friendService, INotificationService notificationService, SyncService syncService)
        {
            _context = context;
            _logger = logger;
            _conversationService = conversationService;
            _serviceProvider = serviceProvider;
            _messageService = messageService;
            _friendService = friendService;
            _notificationService = notificationService;
            _syncService = syncService;
        }

        public async Task<CriticalBootstrapResponseDTO> GetCriticalBootstrapAsync(int userId)
        {
            try
            {
                _logger.LogInformation("🚀 Starting parallel critical bootstrap for userId: {UserId}", userId);

                // PARALLEL: Separate scopes for hver operasjon
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
                
                var conversationMessagesTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var messageService = scope.ServiceProvider.GetRequiredService<IMessageService>();
                    _logger.LogDebug("📋 Starting conversation messages lookup with separate service");
                    return await GetConversationMessagesWithService(userId, messageService);
                });

                _logger.LogInformation("📋 Waiting for parallel tasks to complete...");
                await Task.WhenAll(userTask, conversationsTask, conversationMessagesTask);

                var user = await userTask;
                var conversations = await conversationsTask;
                var conversationMessages = await conversationMessagesTask;

                _logger.LogInformation("📋 Creating response...");
                var response = new CriticalBootstrapResponseDTO
                {
                    User = user.ToUserSummaryDTO(),
                    RecentConversations = conversations,
                    ConversationMessages = conversationMessages,
                    SyncToken = _syncService.GenerateSyncToken() 
                };

                _logger.LogInformation("✅ Parallel critical bootstrap completed for user: {UserName} with {MessageCount} conversation message sets", 
                    user.FullName, conversationMessages.Count);
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

                var userRelationshipsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Getting user relationships with separate context");
                    return await GetUserRelationshipsWithContext(userId, context);
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
                    var messageService = scope.ServiceProvider.GetRequiredService<IMessageService>();
                    _logger.LogDebug("📋 Getting pending message requests with separate service");
                    return await GetPendingMessageRequestsWithService(userId, messageService);
                });
                
                // 
                var messageNotificationsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var messageNotificationService = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
                    _logger.LogDebug("📋 Getting recent notifications with separate service");
                    return await GetRecentMessageNotificationsWithService(userId, messageNotificationService);
                });
                
                var friendInvitationsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var friendService = scope.ServiceProvider.GetRequiredService<FriendService>();
                    _logger.LogDebug("📋 Getting pending friend invitations with separate service");
                    return await GetPendingFriendInvitationsWithService(userId, friendService);
                });
                
                var appNotificationsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                    _logger.LogDebug("📋 Getting app notifications with separate service");
                    return await GetAppNotificationsWithService(userId, notificationService);
                });

                _logger.LogInformation("📋 Waiting for parallel secondary tasks to complete...");
                await Task.WhenAll(settingsTask, userRelationshipsTask, unreadConversationsTask, pendingRequestsTask, messageNotificationsTask, friendInvitationsTask, appNotificationsTask);

                var settings = await settingsTask;
                var userRelationships = await userRelationshipsTask;
                var unreadConversationIds = await unreadConversationsTask;
                var pendingRequests = await pendingRequestsTask; 
                var messageNotifications = await messageNotificationsTask;
                var friendInvitations = await friendInvitationsTask;
                var notifications = await appNotificationsTask;

                _logger.LogInformation("📋 Creating secondary response...");
                var response = new SecondaryBootstrapResponseDTO
                {
                    Settings = settings.ToUserSettingsDTO(),
                    AllUserSummaries = userRelationships,
                    UnreadConversationIds = unreadConversationIds,
                    PendingMessageRequests = pendingRequests,
                    RecentMessageNotifications = messageNotifications,
                    PendingFriendInvitations = friendInvitations,
                    RecentNotifications = notifications,
                };

                _logger.LogInformation(
                    "✅ Parallel secondary bootstrap completed - AllUserSummaries friends/blocked: {RelationshipCount}, Unread: {UnreadCount}, Pending: {PendingCount}, MessageNotifications: {NotificationCount}, FriendInvitations: {InvitationCount}, Notifications: {NotificationCount}",
                    userRelationships.Count, unreadConversationIds.Count, pendingRequests.Count, messageNotifications.Count, friendInvitations.Count, notifications.Count);
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
        
        private async Task<Dictionary<int, List<MessageResponseDTO>>> GetConversationMessagesWithService(
        int userId, 
        IMessageService messageService)
        {
            _logger.LogDebug("🔍 Getting messages for user's conversations {UserId} (separate service)", userId);

            try
            {
                // First get user's recent conversation IDs (using same logic as conversations)
                using var scope = _serviceProvider.CreateScope();
                var conversationService = scope.ServiceProvider.GetRequiredService<ConversationService>();
                
                var conversationResults = await conversationService.GetUserConversationsSortedAsync(
                    userId,
                    includeRejected: false,
                    limit: 10);

                var conversationMessages = new Dictionary<int, List<MessageResponseDTO>>();

                // Get messages for each conversation in parallel
                var messageTasks = conversationResults.Select(async conversationResult =>
                {
                    // ✅ NY SCOPE for hver parallel task
                    using var taskScope = _serviceProvider.CreateScope();
                    var taskMessageService = taskScope.ServiceProvider.GetRequiredService<IMessageService>();
    
                    try
                    {
                        _logger.LogDebug("🔍 Fetching messages for conversation {ConversationId}", conversationResult.Conversation.Id);

                        var messages = await taskMessageService.GetMessagesForConversationAsync(
                            conversationResult.Conversation.Id, 
                            userId, 
                            skip: 0, 
                            take: 20);

                        _logger.LogDebug("✅ Got {MessageCount} messages for conversation {ConversationId}", 
                            messages.Count, conversationResult.Conversation.Id);

                        return new { ConversationId = conversationResult.Conversation.Id, Messages = messages };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ DETAILED ERROR for conversation {ConversationId}: {ErrorMessage}", 
                            conversationResult.Conversation.Id, ex.Message);
                        return new { ConversationId = conversationResult.Conversation.Id, Messages = new List<MessageResponseDTO>() };
                    }
                });

                var messageResults = await Task.WhenAll(messageTasks);

                // Build dictionary
                foreach (var result in messageResults)
                {
                    conversationMessages[result.ConversationId] = result.Messages;
                }

                _logger.LogDebug("✅ Found messages for {ConversationCount} conversations with total {MessageCount} messages", 
                    conversationMessages.Count, 
                    conversationMessages.Values.Sum(m => m.Count));

                return conversationMessages;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get conversation messages for user {UserId}", userId);
                // Return empty dictionary instead of crashing bootstrap
                return new Dictionary<int, List<MessageResponseDTO>>();
            }
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

        private async Task<List<UserSummaryDTO>> GetUserRelationshipsWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting user relationships for user {UserId} (separate context)", userId);

            var currentTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // Get all friend relationships for the user (bidirectional)
            var friendIds = await context.Friends
                .Where(f => f.UserId == userId || f.FriendId == userId)
                .Select(f => f.UserId == userId ? f.FriendId : f.UserId)
                .Distinct()
                .ToListAsync();

            // Get all blocked user relationships (bidirectional)
            var blockRelationships = await context.UserBlock
                .Where(b => b.BlockerId == userId || b.BlockedUserId == userId)
                .Select(b => new { 
                    UserId = b.BlockerId == userId ? b.BlockedUserId : b.BlockerId,
                    IBlockedThem = b.BlockerId == userId,
                    TheyBlockedMe = b.BlockedUserId == userId 
                })
                .ToListAsync();

            var blockedUserIds = blockRelationships.Select(b => b.UserId).Distinct().ToList();

            // Combine all related user IDs
            var allRelatedUserIds = friendIds.Union(blockedUserIds).Distinct().ToList();

            if (!allRelatedUserIds.Any())
            {
                _logger.LogDebug("✅ No user relationships found");
                return new List<UserSummaryDTO>();
            }

            // Get user details for all related users
            var userRelationships = await context.Users
                .Where(u => allRelatedUserIds.Contains(u.Id))
                .Include(u => u.Profile)
                .Select(u => new UserSummaryDTO
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null,
                    GroupRequestStatus = null, // Not relevant in this context
                    isFriend = friendIds.Contains(u.Id) ? true : (bool?)null,
                    isBlocked = blockRelationships.Any(b => b.UserId == u.Id && b.IBlockedThem) ? true : (bool?)null,
                    hasBlockedMe = blockRelationships.Any(b => b.UserId == u.Id && b.TheyBlockedMe) ? true : (bool?)null,
                    LastUpdated = currentTimestamp
                })
                .ToListAsync();

            _logger.LogDebug("✅ Found {RelationshipCount} user relationships - Friends: {FriendCount}, Blocked: {BlockedCount}, HasBlockedMe: {HasBlockedMeCount}", 
                userRelationships.Count, 
                userRelationships.Count(ur => ur.isFriend == true),
                userRelationships.Count(ur => ur.isBlocked == true),
                userRelationships.Count(ur => ur.hasBlockedMe == true)); 
            
            return userRelationships;
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
        
        private async Task<List<MessageRequestDTO>> GetPendingMessageRequestsWithService(int userId, IMessageService messageService)
        {
            _logger.LogDebug("🔍 Getting pending message requests for user {UserId} (separate service)", userId);

            try
            {
                var paginatedResult = await messageService.GetPendingMessageRequestsAsync(userId, page: 1, pageSize: 10);
                return paginatedResult.Requests; // ✅ Hent kun Requests fra paginert result
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get pending message requests for user {UserId}", userId);
                // Returner tom liste istedenfor å krasje bootstrap
                return new List<MessageRequestDTO>();
            }
        }
        
        private async Task<List<MessageNotificationDTO>> GetRecentMessageNotificationsWithService(
            int userId, 
            MessageNotificationService messageNotificationService)
        {
            _logger.LogDebug("🔍 Getting recent notifications for user {UserId} (separate service)", userId);

            try
            {
                // Hent kun første side av notifications for bootstrap (20 stk)
                var (notifications, _) = await messageNotificationService.GetUserNotificationsAsync(
                    userId, 
                    page: 1, 
                    pageSize: 20);

                return notifications; // 🔧 Returner kun notifications
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get recent notifications for user {UserId}", userId);
                // Returner tom liste istedenfor å krasje bootstrap
                return new List<MessageNotificationDTO>();
            }
        }
        
        private async Task<List<FriendInvitationDTO>> GetPendingFriendInvitationsWithService(
            int userId, 
            FriendService friendService)
        {
            _logger.LogDebug("🔍 Getting pending friend invitations for user {UserId} (separate service)", userId);

            try
            {
                return await friendService.GetPendingFriendInvitationsForBootstrapAsync(userId, limit: 10);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get pending friend invitations for user {UserId}", userId);
                return new List<FriendInvitationDTO>(); // Robust: returner tom liste
            }
        }
        
        private async Task<List<NotificationDTO>> GetAppNotificationsWithService(
            int userId, 
            INotificationService notificationService)
        {
            _logger.LogDebug("🔍 Getting app notifications for user {UserId} (separate service)", userId);

            try
            {
                return await notificationService.GetRecentNotificationsForBootstrapAsync(userId, limit: 20);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get app notifications for user {UserId}", userId);
                return new List<NotificationDTO>(); // Robust: returner tom liste
            }
        }
    }
}