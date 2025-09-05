using AFBack.DTOs;
using AFBack.Models;
using AFBack.Data;
using AFBack.DTOs.BoostrapDTO;
using AFBack.DTOs.Crypto;
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
        private readonly IMessageService _messageService;
        private readonly FriendService _friendService;
        private readonly INotificationService _notificationService;
        private readonly SyncService _syncService;

        public BootstrapService(ApplicationDbContext context, ILogger<BootstrapService> logger,
            ConversationService conversationService, IServiceProvider serviceProvider, IMessageService messageService, 
            FriendService friendService, INotificationService notificationService, SyncService syncService)
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

                var settingsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    _logger.LogDebug("📋 Starting settings lookup with separate context");
                    return await GetUserSettingsWithContext(userId, context);
                });

                _logger.LogInformation("📋 Waiting for parallel critical tasks to complete...");
                await Task.WhenAll(userTask, settingsTask);

                var user = await userTask;
                var settings = await settingsTask;

                _logger.LogInformation("📋 Creating critical response...");
                var response = new CriticalBootstrapResponseDTO
                {
                    User = user.ToUserSummaryDTO(),
                    Settings = settings?.ToUserSettingsDTO() ?? new UserSettingsDTO(),
                    SyncToken = _syncService.GenerateSyncToken()
                };

                _logger.LogInformation("✅ Critical bootstrap completed for user: {UserName}", user.FullName);
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

                // PARALLEL: Separate scopes for hver operasjon
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

                var pendingRequestsTask = Task.Run(async () =>
                {
                    using var scope = _serviceProvider.CreateScope();
                    var messageService = scope.ServiceProvider.GetRequiredService<IMessageService>();
                    _logger.LogDebug("📋 Getting pending message requests with separate service");
                    return await GetPendingMessageRequestsWithService(userId, messageService);
                });
                
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
                await Task.WhenAll(conversationsTask, conversationMessagesTask, userRelationshipsTask, 
                    unreadConversationsTask, pendingRequestsTask, messageNotificationsTask, 
                    friendInvitationsTask, appNotificationsTask);

                var conversations = await conversationsTask;
                var conversationMessages = await conversationMessagesTask;
                var userRelationships = await userRelationshipsTask;
                var unreadConversationIds = await unreadConversationsTask;
                var pendingRequests = await pendingRequestsTask; 
                var messageNotifications = await messageNotificationsTask;
                var friendInvitations = await friendInvitationsTask;
                var notifications = await appNotificationsTask;

                _logger.LogInformation("📋 Creating secondary response...");
                var response = new SecondaryBootstrapResponseDTO
                {
                    RecentConversations = conversations,
                    ConversationMessages = conversationMessages,
                    AllUserSummaries = userRelationships,
                    UnreadConversationIds = unreadConversationIds,
                    PendingMessageRequests = pendingRequests,
                    RecentMessageNotifications = messageNotifications,
                    PendingFriendInvitations = friendInvitations,
                    RecentNotifications = notifications,
                };

                _logger.LogInformation(
                    "✅ Secondary bootstrap completed - Conversations: {ConversationCount}, Messages: {MessageCount}, " +
                    "UserRelationships: {RelationshipCount}, Unread: {UnreadCount}, Pending: {PendingCount}, " +
                    "MessageNotifications: {NotificationCount}, FriendInvitations: {InvitationCount}, " +
                    "AppNotifications: {AppNotificationCount}",
                    conversations.Count, conversationMessages.Values.Sum(m => m.Count), userRelationships.Count, 
                    unreadConversationIds.Count, pendingRequests.Count, messageNotifications.Count, 
                    friendInvitations.Count, notifications.Count);
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get secondary bootstrap for user {UserId}", userId);
                throw;
            }
        }
        
        // CRITICAL BOOTSTRAP METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private async Task<Models.User> GetCurrentUserWithContext(int userId, ApplicationDbContext context)
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

        private async Task<UserSettings?> GetUserSettingsWithContext(int userId, ApplicationDbContext context)
        {
            _logger.LogDebug("🔍 Getting settings for user {UserId} (separate context)", userId);

            var settings = await context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            _logger.LogDebug("✅ Settings found: {HasSettings}", settings != null);
            return settings;
        }

        // SECONDARY BOOTSTRAP METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
        
        private async Task<Dictionary<int, List<EncryptedMessageResponseDTO>>> GetConversationMessagesWithService(
            int userId, 
            IMessageService messageService)
        {
            _logger.LogDebug("🔍 Getting encrypted messages for user's conversations {UserId} (separate service)", userId);

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var conversationService = scope.ServiceProvider.GetRequiredService<ConversationService>();
                
                var conversationResults = await conversationService.GetUserConversationsSortedAsync(
                    userId,
                    includeRejected: false,
                    limit: 10);

                var conversationMessages = new Dictionary<int, List<EncryptedMessageResponseDTO>>();

                var messageTasks = conversationResults.Select(async conversationResult =>
                {
                    using var taskScope = _serviceProvider.CreateScope();
                    var taskMessageService = taskScope.ServiceProvider.GetRequiredService<IMessageService>();

                    try
                    {
                        _logger.LogDebug("🔍 Fetching encrypted messages for conversation {ConversationId}", conversationResult.Conversation.Id);

                        var messages = await taskMessageService.GetMessagesForConversationAsync(
                            conversationResult.Conversation.Id, 
                            userId, 
                            skip: 0, 
                            take: 20);

                        _logger.LogDebug("✅ Got {MessageCount} encrypted messages for conversation {ConversationId}", 
                            messages.Count, conversationResult.Conversation.Id);

                        return new { ConversationId = conversationResult.Conversation.Id, Messages = messages };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ DETAILED ERROR for conversation {ConversationId}: {ErrorMessage}", 
                            conversationResult.Conversation.Id, ex.Message);
                        return new { ConversationId = conversationResult.Conversation.Id, Messages = new List<EncryptedMessageResponseDTO>() };
                    }
                });

                var messageResults = await Task.WhenAll(messageTasks);

                foreach (var result in messageResults)
                {
                    conversationMessages[result.ConversationId] = result.Messages;
                }

                _logger.LogDebug("✅ Found encrypted messages for {ConversationCount} conversations with total {MessageCount} messages", 
                    conversationMessages.Count, 
                    conversationMessages.Values.Sum(m => m.Count));

                return conversationMessages;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get conversation messages for user {UserId}", userId);
                return new Dictionary<int, List<EncryptedMessageResponseDTO>>();
            }
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
            var blockRelationships = await context.UserBlocks
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

            var users = await context.Users
                .Where(u => allRelatedUserIds.Contains(u.Id))
                .Include(u => u.Profile)
                .Select(u => new 
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.Profile != null ? u.Profile.ProfileImageUrl : null
                })
                .ToListAsync();

            var userRelationships = users.Select(u => new UserSummaryDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl,
                GroupRequestStatus = null,
                isFriend = friendIds.Contains(u.Id) ? true : (bool?)null,
                isBlocked = blockRelationships.Any(b => b.UserId == u.Id && b.IBlockedThem) ? true : (bool?)null,
                hasBlockedMe = blockRelationships.Any(b => b.UserId == u.Id && b.TheyBlockedMe) ? true : (bool?)null,
                LastUpdated = currentTimestamp
            }).ToList();

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
                return paginatedResult.Requests;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get pending message requests for user {UserId}", userId);
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
                var (notifications, _) = await messageNotificationService.GetUserNotificationsAsync(
                    userId, 
                    page: 1, 
                    pageSize: 20);

                return notifications;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to get recent notifications for user {UserId}", userId);
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
                return new List<FriendInvitationDTO>();
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
                return new List<NotificationDTO>();
            }
        }
    }
}