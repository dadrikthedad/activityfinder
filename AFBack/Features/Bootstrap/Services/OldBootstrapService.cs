using AFBack.Common.DTOs;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.Features.Auth.Models;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Features.Settings.Models;
using AFBack.Features.SyncEvents.Services;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Bootstrap.Services 
{

        public async Task<SecondaryBootstrapResponseDTO> GetSecondaryBootstrapAsync(int userId)
        {
            try
            {
                logger.LogInformation("📚 Starting parallel secondary bootstrap for userId: {UserId}", userId);

                // PARALLEL: Separate scopes for hver operasjon
                var conversationsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var conversationService = scope.ServiceProvider.GetRequiredService<ConversationService>();
                    logger.LogDebug("📋 Starting conversations lookup with separate service");
                    return await GetConversationsWithService(userId, 10, conversationService);
                });
                
                var conversationMessagesTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var messageService = scope.ServiceProvider.GetRequiredService<IMessageService>();
                    logger.LogDebug("📋 Starting conversation messages lookup with separate service");
                    return await GetConversationMessagesWithService(userId, messageService);
                });

                var userRelationshipsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    logger.LogDebug("📋 Getting appUser relationships with separate context");
                    return await GetUserRelationshipsWithContext(userId, context);
                });

                var unreadConversationsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    logger.LogDebug("📋 Getting unread conversation IDs with separate context");
                    return await GetUnreadConversationIdsWithContext(userId, context);
                });

                var pendingRequestsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var messageService = scope.ServiceProvider.GetRequiredService<IMessageService>();
                    logger.LogDebug("📋 Getting pending message requests with separate service");
                    return await GetPendingMessageRequestsWithService(userId, messageService);
                });
                
                var messageNotificationsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var messageNotificationService = scope.ServiceProvider.GetRequiredService<MessageNotificationService>();
                    logger.LogDebug("📋 Getting recent notifications with separate service");
                    return await GetRecentMessageNotificationsWithService(userId, messageNotificationService);
                });
                
                var friendInvitationsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var friendService = scope.ServiceProvider.GetRequiredService<FriendService>();
                    logger.LogDebug("📋 Getting pending friend invitations with separate service");
                    return await GetPendingFriendInvitationsWithService(userId, friendService);
                });
                
                var appNotificationsTask = Task.Run(async () =>
                {
                    using var scope = serviceProvider.CreateScope();
                    var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                    logger.LogDebug("📋 Getting app notifications with separate service");
                    return await GetAppNotificationsWithService(userId, notificationService);
                });

                logger.LogInformation("📋 Waiting for parallel secondary tasks to complete...");
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

                logger.LogInformation("📋 Creating secondary response...");
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

                logger.LogInformation(
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
                logger.LogError(ex, "❌ Failed to get secondary bootstrap for appUser {UserId}", userId);
                throw;
            }
        }
        
        // CRITICAL BOOTSTRAP METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private async Task<AppUser> GetCurrentUserWithContext(int userId, AppDbContext context)
        {
            logger.LogDebug("🔍 Looking up appUser with ID: {UserId} (separate context)", userId);

            var user = await context.AppUsers
                .Include(u => u.UserProfile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                logger.LogWarning("⚠️ AppUser with ID {UserId} not found", userId);
                throw new KeyNotFoundException($"AppUser with ID {userId} not found");
            }

            logger.LogDebug("✅ AppUser found: {UserName}", user.FullName);

            // Oppdater LastSeen når brukeren starter appen
            user.LastSeen = DateTime.UtcNow;
            await context.SaveChangesAsync();

            return user;
        }

        private async Task<UserSettings?> GetUserSettingsWithContext(int userId, AppDbContext context)
        {
            logger.LogDebug("🔍 Getting settings for appUser {UserId} (separate context)", userId);

            var settings = await context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            logger.LogDebug("✅ UserSettings found: {HasSettings}", settings != null);
            return settings;
        }

        // SECONDARY BOOTSTRAP METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        private async Task<List<ConversationDto>> GetConversationsWithService(int userId, int limit,
            ConversationService conversationService)
        {
            logger.LogDebug("🔍 Getting {Limit} recent conversations for appUser {UserId} (separate service)", limit,
                userId);

            var conversationResults = await conversationService.GetUserConversationsSortedAsync(
                userId,
                includeRejected: false,
                limit: limit);

            logger.LogDebug("✅ Found {ConversationCount} conversations", conversationResults.Count);

            return conversationResults
                .Select(c => new ConversationDto
                {
                    Id = c.Conversation.Id,
                    GroupName = c.Conversation.GroupName,
                    IsGroup = c.Conversation.IsGroup,
                    GroupImageUrl = c.Conversation.GroupImageUrl,
                    LastMessageSentAt = c.Conversation.LastMessageSentAt,
                    Participants = c.Conversation.Participants.Select(p => new ConversationParticipantDto
                    {
                        User = new UserSummaryDto
                        {
                            Id = p.User.Id,
                            FullName = p.User.FullName,
                            ProfileImageUrl = p.User.ProfileImageUrl,
                        },
                        ConversationStatus = p.ConversationStatus ?? ConversationStatus.Pending,
                    }).ToList()
                })
                .ToList();
        }
        
        private async Task<Dictionary<int, List<EncryptedMessageResponseDTO>>> GetConversationMessagesWithService(
            int userId, 
            IMessageService messageService)
        {
            logger.LogDebug("🔍 Getting encrypted messages for appUser's conversations {UserId} (separate service)", userId);

            try
            {
                using var scope = serviceProvider.CreateScope();
                var conversationService = scope.ServiceProvider.GetRequiredService<ConversationService>();
                
                var conversationResults = await conversationService.GetUserConversationsSortedAsync(
                    userId,
                    includeRejected: false,
                    limit: 10);

                var conversationMessages = new Dictionary<int, List<EncryptedMessageResponseDTO>>();

                var messageTasks = conversationResults.Select(async conversationResult =>
                {
                    using var taskScope = serviceProvider.CreateScope();
                    var taskMessageService = taskScope.ServiceProvider.GetRequiredService<IMessageService>();

                    try
                    {
                        logger.LogDebug("🔍 Fetching encrypted messages for conversation {ConversationId}", conversationResult.Conversation.Id);

                        var messages = await taskMessageService.GetMessagesForConversationAsync(
                            conversationResult.Conversation.Id, 
                            userId, 
                            skip: 0, 
                            take: 20);

                        logger.LogDebug("✅ Got {MessageCount} encrypted messages for conversation {ConversationId}", 
                            messages.Count, conversationResult.Conversation.Id);

                        return new { ConversationId = conversationResult.Conversation.Id, Messages = messages };
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "❌ DETAILED ERROR for conversation {ConversationId}: {ErrorMessage}", 
                            conversationResult.Conversation.Id, ex.Message);
                        return new { ConversationId = conversationResult.Conversation.Id, Messages = new List<EncryptedMessageResponseDTO>() };
                    }
                });

                var messageResults = await Task.WhenAll(messageTasks);

                foreach (var result in messageResults)
                {
                    conversationMessages[result.ConversationId] = result.Messages;
                }

                logger.LogDebug("✅ Found encrypted messages for {ConversationCount} conversations with total {MessageCount} messages", 
                    conversationMessages.Count, 
                    conversationMessages.Values.Sum(m => m.Count));

                return conversationMessages;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Failed to get conversation messages for appUser {UserId}", userId);
                return new Dictionary<int, List<EncryptedMessageResponseDTO>>();
            }
        }

        private async Task<List<UserSummaryDto>> GetUserRelationshipsWithContext(int userId, AppDbContext context)
        {
            logger.LogDebug("🔍 Getting appUser relationships for appUser {UserId} (separate context)", userId);

            var currentTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // Get all friend relationships for the appUser (bidirectional)
            var friendIds = await context.Friendships
                .Where(f => f.UserId == userId || f.FriendId == userId)
                .Select(f => f.UserId == userId ? f.FriendId : f.UserId)
                .Distinct()
                .ToListAsync();

            // Get all blocked appUser relationships (bidirectional)
            var blockRelationships = await context.UserBlocks
                .Where(b => b.BlockerId == userId || b.BlockedUserId == userId)
                .Select(b => new { 
                    UserId = b.BlockerId == userId ? b.BlockedUserId : b.BlockerId,
                    IBlockedThem = b.BlockerId == userId,
                    TheyBlockedMe = b.BlockedUserId == userId 
                })
                .ToListAsync();

            var blockedUserIds = blockRelationships.Select(b => b.UserId).Distinct().ToList();

            // Combine all related appUser IDs
            var allRelatedUserIds = friendIds.Union(blockedUserIds).Distinct().ToList();

            if (!allRelatedUserIds.Any())
            {
                logger.LogDebug("✅ No appUser relationships found");
                return new List<UserSummaryDto>();
            }

            var users = await context.AppUsers
                .Where(u => allRelatedUserIds.Contains(u.Id))
                .Include(u => u.Profile)
                .Select(u => new 
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    ProfileImageUrl = u.Profile != null ? u.ProfileImageUrl : null
                })
                .ToListAsync();

            var userRelationships = users.Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FullName = u.FullName,
                ProfileImageUrl = u.ProfileImageUrl,
                isFriend = friendIds.Contains(u.Id) ? true : (bool?)null,
                isBlocked = blockRelationships.Any(b => b.UserId == u.Id && b.IBlockedThem) ? true : (bool?)null,
                hasBlockedMe = blockRelationships.Any(b => b.UserId == u.Id && b.TheyBlockedMe) ? true : (bool?)null,
                LastUpdated = currentTimestamp
            }).ToList();

            logger.LogDebug("✅ Found {RelationshipCount} appUser relationships - Friends: {FriendCount}, Blocked: {BlockedCount}, HasBlockedMe: {HasBlockedMeCount}", 
                userRelationships.Count, 
                userRelationships.Count(ur => ur.isFriend == true),
                userRelationships.Count(ur => ur.isBlocked == true),
                userRelationships.Count(ur => ur.hasBlockedMe == true)); 
            
            return userRelationships;
        }
        
        private async Task<List<int>> GetUnreadConversationIdsWithContext(int userId, AppDbContext context)
        {
            logger.LogDebug("🔍 Getting unread conversation IDs for appUser {UserId} (separate context)", userId);

            var unreadConvIds = await context.MessageNotifications
                .Where(n => n.RecipientId == userId && !n.IsRead && n.ConversationId != null)
                .Select(n => n.ConversationId!.Value)
                .Distinct()
                .ToListAsync();

            logger.LogDebug("✅ Found {UnreadCount} unread conversations", unreadConvIds.Count);
            return unreadConvIds;
        }
        
        private async Task<List<MessageRequestDTO>> GetPendingMessageRequestsWithService(int userId, IMessageService messageService)
        {
            logger.LogDebug("🔍 Getting pending message requests for appUser {UserId} (separate service)", userId);

            try
            {
                var paginatedResult = await messageService.GetPendingMessageRequestsAsync(userId, page: 1, pageSize: 10);
                return paginatedResult.Requests;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Failed to get pending message requests for appUser {UserId}", userId);
                return new List<MessageRequestDTO>();
            }
        }
        
        private async Task<List<MessageNotificationDTO>> GetRecentMessageNotificationsWithService(
            int userId, 
            IMessageNotificationService messageNotificationService)
        {
            logger.LogDebug("🔍 Getting recent notifications for appUser {UserId} (separate service)", userId);

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
                logger.LogError(ex, "❌ Failed to get recent notifications for appUser {UserId}", userId);
                return new List<MessageNotificationDTO>();
            }
        }
        
        private async Task<List<FriendInvitationDTO>> GetPendingFriendInvitationsWithService(
            int userId, 
            FriendService friendService)
        {
            logger.LogDebug("🔍 Getting pending friend invitations for appUser {UserId} (separate service)", userId);

            try
            {
                return await friendService.GetPendingFriendInvitationsForBootstrapAsync(userId, limit: 10);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Failed to get pending friend invitations for appUser {UserId}", userId);
                return new List<FriendInvitationDTO>();
            }
        }
        
        private async Task<List<NotificationDTO>> GetAppNotificationsWithService(
            int userId, 
            INotificationService notificationService)
        {
            logger.LogDebug("🔍 Getting app notifications for appUser {UserId} (separate service)", userId);

            try
            {
                return await notificationService.GetRecentNotificationsForBootstrapAsync(userId, limit: 20);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ Failed to get app notifications for appUser {UserId}", userId);
                return new List<NotificationDTO>();
            }
        }
    }
}
