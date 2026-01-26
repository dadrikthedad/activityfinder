using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.MessageNotification.Service;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Models.Enums;
using AFBack.Repository;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.Conversation.Services;

public class GroupConversationService(ILogger<GroupConversationService> logger,
    IConversationRepository conversationRepository,
    IConversationLeftRecordRepository conversationLeftRecordRepository,
    ISyncService syncService,
    ISendMessageCache msgCache,
    IUserBlockRepository userBlockRepository,
    ISendMessageService messageService,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService,
    IUserSummaryCacheService userSummariesCache) : IGroupConversationService
{
    // Sjekk interface for summary
    public async Task<Result<CreateGroupConversationResponse>> CreateGroupConversationAsync(
        string userId, CreateGroupConversationRequest request)
    {
        logger.LogInformation("User {UserId} is attempting to create group conversation with {Count} participants",
            userId, request.ReceiverIds.Count);
        
        // ============ VALIDERING: ReceiverIds ============
        
        // Sjekk for duplikater
        var uniqueReceiverIds = request.ReceiverIds.Distinct().ToList();
        if (uniqueReceiverIds.Count != request.ReceiverIds.Count)
        {
            logger.LogWarning("User {UserId} provided duplicate receiver IDs", userId);
            return Result<CreateGroupConversationResponse>.Failure(
                "Duplicate user IDs in receiver list");
        }

        // Sjekk at creator ikke er med i ReceiverIds
        if (uniqueReceiverIds.Contains(userId))
        {
            logger.LogWarning("User {UserId} tried to include themselves in receiver list", userId);
            return Result<CreateGroupConversationResponse>.Failure(
                "You cannot invite yourself");
        }

        // Hent alle users (creator + receivers) via cache - validerer eksistens og gir oss data for senere i metoden
        var allUserIds = new List<string> { userId };
        allUserIds.AddRange(uniqueReceiverIds);

        var users = await userSummariesCache.GetUserSummariesAsync(allUserIds);

        // Sjekk hvilke receivere som ikke eksisterer
        var nonExistentReceivers = uniqueReceiverIds
            .Where(id => !users.ContainsKey(id))
            .ToList();

        if (nonExistentReceivers.Any())
        {
            logger.LogWarning("User {UserId} tried to invite non-existent users: {UserIds}",
                userId, string.Join(", ", nonExistentReceivers));
            return Result<CreateGroupConversationResponse>.Failure(
                "One or more users do not exist", ErrorTypeEnum.NotFound);
        }

        // Sjekk at creator eksisterer (edge case)
        if (!users.ContainsKey(userId))
        {
            logger.LogCritical("Creator {UserId} not found in UserSummary cache", userId);
            return Result<CreateGroupConversationResponse>.Failure(
                "User not found", ErrorTypeEnum.NotFound);
        }
        
        // ============ VALIDERING: Blokkeringer ============
        
        var blockedUsers = new List<string>();

        foreach (var receiverId in uniqueReceiverIds)
        {
            // Sjekk om creator har blokkert receiver
            if (await userBlockRepository.IsFirstUserBlockedBySecondary(receiverId, userId))
            {
                logger.LogWarning("User {UserId} tried to invite blocked user {ReceiverId}", 
                    userId, receiverId);
                blockedUsers.Add(receiverId);
                continue;
            }
    
            // Sjekk om receiver har blokkert creator
            if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId, receiverId))
            {
                logger.LogWarning("User {UserId} tried to invite user {ReceiverId} who has blocked them", 
                    userId, receiverId);
                blockedUsers.Add(receiverId);
            }
        }

        if (blockedUsers.Any())
        {
            logger.LogWarning(
                "User {UserId} cannot create group: {Count} blocked users: {BlockedIds}",
                userId, blockedUsers.Count, string.Join(", ", blockedUsers));
    
            return Result<CreateGroupConversationResponse>.Failure(
                $"Cannot invite users: {string.Join(", ", blockedUsers)}",
                ErrorTypeEnum.Forbidden);
        }
        
        // ============ DATABASE: Opprett gruppe ============
        
        var conversation = new Models.Conversation
        {
            Type = ConversationType.GroupChat,
            GroupName = request.GroupName,
            GroupImageUrl = request.GroupImageUrl,
            GroupDescription = request.GroupDescription
        };
        
        var participants = new List<ConversationParticipant>();
        
        // Creator
        var creatorParticipant = new ConversationParticipant
        {
            UserId = userId,
            Status = ConversationStatus.Accepted,
            Role = ParticipantRole.Creator,
            JoinedAt = DateTime.UtcNow,
            InvitedAt = DateTime.UtcNow
        };
        participants.Add(creatorParticipant);
        
        // Receivers (inviterte brukere med Pending status)
        foreach (var receiverId in uniqueReceiverIds)
        {
            var receiverParticipant = new ConversationParticipant
            {
                UserId = receiverId,
                Status = ConversationStatus.Pending,
                Role = ParticipantRole.Member,
                InvitedAt = DateTime.UtcNow
            };
            participants.Add(receiverParticipant);
        }
        
        // Lagre i database (uten melding for gruppesamtaler)
        var createdConversation = await conversationRepository
            .CreateConversationWithParticipantsAsync(conversation, participants);
        
        logger.LogInformation("User {UserId} created group conversation {ConversationId}",
            userId, createdConversation.Id);
        
        // ============ POST-COMMIT: Cache ============
        
        try
        {
            await msgCache.OnCanSendAddedAsync(userId, createdConversation.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add creator to CanSend cache for conversation {ConversationId}",
                createdConversation.Id);
        }
        
        // ============ POST-COMMIT: Systemmeldinger ============
        
        var creatorName = users.TryGetValue(userId, out var creatorUser) 
            ? creatorUser.FullName 
            : "Someone";
        
        // Systemmelding 1: Gruppe opprettet
        try
        {
            await messageService.SendSystemMessageAsync(createdConversation.Id,  
                $"{creatorName} created the group");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send 'created group' system message for group {ConversationId}",
                createdConversation.Id);
        }
        
        // Systemmelding 2: Description (hvis satt)
        if (!string.IsNullOrWhiteSpace(request.GroupDescription))
        {
            try
            {
                await messageService.SendSystemMessageAsync(createdConversation.Id,
                    $"Group description: {request.GroupDescription}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send description system message for group {ConversationId}",
                    createdConversation.Id);
            }
        }
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(createdConversation.Id);
        if (conversationDto == null)
        {
            logger.LogCritical("Created group conversation {ConversationId} not found after creation",
                createdConversation.Id);
            return Result<CreateGroupConversationResponse>.Failure(
                "Failed to retrieve created conversation", ErrorTypeEnum.InternalServerError);
        }
        
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SyncEvents, SignalR, Notifications ============
        
        var createGroupConversationResponse = new CreateGroupConversationResponse
        {
            ConversationId = createdConversation.Id,
            Conversation = conversationResponse
        };
        
        // SyncEvent for creator
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationCreated,
                createGroupConversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for creator {UserId}", userId);
        }
        
        // SignalR, Notification og SyncEvent for hver receiver - parallelt
        var notificationTasks = uniqueReceiverIds.Select(async receiverId =>
        {
            try
            {
                var signalRTask = hubContext.Clients.User(receiverId)
                    .SendAsync("GroupInviteReceived", createGroupConversationResponse);
        
                var notificationTask = messageNotificationService.CreatePendingConversationNotificationAsync(
                    receiverId, userId, conversationResponse);
        
                var syncTask = syncService.CreateSyncEventsAsync(
                    [receiverId],
                    SyncEventType.GroupInviteReceived,
                    createGroupConversationResponse);

                await Task.WhenAll(signalRTask, notificationTask, syncTask);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, 
                    "Failed to send notifications to receiver {ReceiverId} for group {ConversationId}",
                    receiverId, createdConversation.Id);
            }
        });

        await Task.WhenAll(notificationTasks);
        
        logger.LogInformation(
            "User {UserId} successfully created group {ConversationId} with {Count} participants.",
            userId, createdConversation.Id, uniqueReceiverIds.Count);
        
        return Result<CreateGroupConversationResponse>.Success(createGroupConversationResponse);
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> AcceptPendingGroupConversationRequestAsync(
        string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to accept group invitation {ConversationId}", 
            userId, conversationId);
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to accept non-existent group conversation {ConversationId}",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        if (conversation.Type != ConversationType.GroupChat)
        {
            logger.LogError("User {UserId} tried to accept conversation {ConversationId} that is not a group (Type: {Type})",
                userId, conversationId, conversation.Type);
            return Result<ConversationResponse>.Failure("This endpoint is only for group conversations");
        }
        
        var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (userParticipant == null)
        {
            logger.LogError("User {UserId} tried to accept group {ConversationId} without being a participant",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        if (userParticipant.Status == ConversationStatus.Accepted)
        {
            logger.LogError("User {UserId} tried to accept group {ConversationId} but is already a member",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("You are already a member of this group");
        }
        
        // ============ DATABASE: Oppdater participant ============
        
        userParticipant.Status = ConversationStatus.Accepted;
        userParticipant.Role = ParticipantRole.Member;
        userParticipant.JoinedAt = DateTime.UtcNow;
        
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully accepted group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Cache ============
        
        try
        {
            await msgCache.OnCanSendAddedAsync(userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add user {UserId} to CanSend cache for group {ConversationId}", 
                userId, conversationId);
        }
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var userName = users.TryGetValue(userId, out var user) ? user.FullName : "Someone";
        
        // Send systemmelding
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, $"{userName} joined the group");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after accepting", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }

        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SignalR, SyncEvents, Notifications ============
        
        var otherAcceptedMemberIds = conversation.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        // SyncEvent for brukeren som aksepterte
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.GroupInviteAcceptedByMe,
                conversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for user {UserId} accepting group {ConversationId}", 
                userId, conversationId);
        }
        
        // Notifiser andre medlemmer
        if (otherAcceptedMemberIds.Any())
        {
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                try
                {
                    var signalRTask = hubContext.Clients.User(memberId)
                        .SendAsync("GroupMemberJoined", new { Conversation = conversationResponse });
            
                    var notificationTask = messageNotificationService.CreateGroupMemberJoinedNotificationAsync(
                        memberId, userId, conversationResponse);
            
                    var syncTask = syncService.CreateSyncEventsAsync(
                        [memberId],
                        SyncEventType.GroupInviteAccepted,
                        conversationResponse);

                    await Task.WhenAll(signalRTask, notificationTask, syncTask);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, 
                        "Failed to notify member {MemberId} about user {UserId} joining group {ConversationId}",
                        memberId, userId, conversationId);
                }
            });

            await Task.WhenAll(memberTasks);
        }
        
        logger.LogInformation(
            "User {UserId} successfully joined group {ConversationId}. Notified {MemberCount} other members.",
            userId, conversationId, otherAcceptedMemberIds.Count);
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
    
    // Sjekk interface for summary
    public async Task<Result> RejectPendingGroupConversationRequestAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to reject group invitation {ConversationId}", 
            userId, conversationId);
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to reject non-existent group conversation {ConversationId}",
                userId, conversationId);
            return Result.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        if (conversation.Type != ConversationType.GroupChat)
        {
            logger.LogError("User {UserId} tried to reject conversation {ConversationId} that is not a group (Type: {Type})",
                userId, conversationId, conversation.Type);
            return Result.Failure("This endpoint is only for group conversations", ErrorTypeEnum.BadRequest);
        }
        
        var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (userParticipant == null)
        {
            logger.LogError("User {UserId} tried to reject group {ConversationId} without being a participant",
                userId, conversationId);
            return Result.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        if (userParticipant.Status == ConversationStatus.Accepted)
        {
            logger.LogError("User {UserId} tried to reject group {ConversationId} but is already a member",
                userId, conversationId);
            return Result.Failure(
                "You are already a member of this group. Use the leave endpoint instead.", 
                ErrorTypeEnum.BadRequest);
        }
        
        // ============ DATABASE: Opprett ConversationLeftRecord og fjern participant ============
        
        var leftRecord = new ConversationLeftRecord
        {
            UserId = userId,
            ConversationId = conversationId
        };
        
        await conversationLeftRecordRepository.CreateAsync(leftRecord);
        await conversationRepository.RemoveParticipantAsync(userParticipant);
        
        logger.LogInformation("User {UserId} successfully rejected group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: SyncEvent ============
        
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationRejected,
                conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for rejected group {ConversationId}", 
                conversationId);
        }
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> InviteGroupMembersAsync(
        string userId, int conversationId, InviteGroupMemberRequest request)
    {
        logger.LogInformation(
            "User {UserId} is attempting to invite {Count} users to group {ConversationId}",
            userId, request.ReceiverIds.Count, conversationId);
        
        // ============ VALIDERING: Samtale ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        if (conversation == null)
        {
            logger.LogError("User {UserId} tried to invite to non-existent group {ConversationId}",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        if (conversation.Type != ConversationType.GroupChat)
        {
            logger.LogError(
                "User {UserId} tried to invite to conversation {ConversationId} that is not a group (Type: {Type})",
                userId, conversationId, conversation.Type);
            return Result<ConversationResponse>.Failure("This endpoint is only for group conversations");
        }
        
        // ============ VALIDERING: Inviterende bruker ============
        
        var inviterParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (inviterParticipant == null)
        {
            logger.LogError("User {UserId} tried to invite to group {ConversationId} without being a participant",
                userId, conversationId);
            return Result<ConversationResponse>.Failure("Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        if (inviterParticipant.Status != ConversationStatus.Accepted)
        {
            logger.LogError(
                "User {UserId} tried to invite to group {ConversationId} but has status {Status}",
                userId, conversationId, inviterParticipant.Status);
            return Result<ConversationResponse>.Failure(
                "You must accept the group invitation before inviting others", ErrorTypeEnum.Forbidden);
        }
        
        // ============ VALIDERING: ReceiverIds ============
        
        var uniqueReceiverIds = request.ReceiverIds.Distinct().ToList();
        if (uniqueReceiverIds.Count != request.ReceiverIds.Count)
        {
            logger.LogWarning("User {UserId} provided duplicate receiver IDs", userId);
            return Result<ConversationResponse>.Failure("Duplicate user IDs in receiver list");
        }
        
        if (uniqueReceiverIds.Contains(userId))
        {
            logger.LogWarning("User {UserId} tried to include themselves in invite list", userId);
            return Result<ConversationResponse>.Failure("You cannot invite yourself");
        }
        
        var allUserIds = new List<string> { userId };
        allUserIds.AddRange(uniqueReceiverIds);
        var users = await userSummariesCache.GetUserSummariesAsync(allUserIds);
        
        var nonExistentReceivers = uniqueReceiverIds.Where(id => !users.ContainsKey(id)).ToList();
        
        if (nonExistentReceivers.Any())
        {
            logger.LogWarning("User {UserId} tried to invite non-existent users: {UserIds}",
                userId, string.Join(", ", nonExistentReceivers));
            return Result<ConversationResponse>.Failure(
                "One or more users do not exist", ErrorTypeEnum.NotFound);
        }
        
        // ============ VALIDERING: Allerede participant ============
        
        var existingParticipantIds = conversation.Participants.Select(p => p.UserId).ToHashSet();
        var alreadyParticipants = uniqueReceiverIds.Where(id => existingParticipantIds.Contains(id)).ToList();
        
        if (alreadyParticipants.Any())
        {
            logger.LogWarning(
                "User {UserId} tried to invite users already in group {ConversationId}: {UserIds}",
                userId, conversationId, string.Join(", ", alreadyParticipants));
            return Result<ConversationResponse>.Failure(
                $"Users already in group: {string.Join(", ", alreadyParticipants)}");
        }
        
        // ============ VALIDERING: ConversationLeftRecord ============
        
        var usersWhoLeft = new List<string>();
        foreach (var receiverId in uniqueReceiverIds)
        {
            if (await conversationLeftRecordRepository.ExistsAsync(receiverId, conversationId))
            {
                usersWhoLeft.Add(receiverId);
            }
        }
        
        if (usersWhoLeft.Any())
        {
            logger.LogWarning(
                "User {UserId} tried to invite users who left group {ConversationId}: {UserIds}",
                userId, conversationId, string.Join(", ", usersWhoLeft));
            return Result<ConversationResponse>.Failure(
                $"Cannot invite users who have left the group: {string.Join(", ", usersWhoLeft)}",
                ErrorTypeEnum.Forbidden);
        }
        
        // ============ VALIDERING: Blokkeringer ============
        
        var blockedUsers = new List<string>();
        
        foreach (var receiverId in uniqueReceiverIds)
        {
            if (await userBlockRepository.IsFirstUserBlockedBySecondary(receiverId, userId))
            {
                logger.LogWarning("User {UserId} tried to invite blocked user {ReceiverId}", userId, receiverId);
                blockedUsers.Add(receiverId);
                continue;
            }
            
            if (await userBlockRepository.IsFirstUserBlockedBySecondary(userId, receiverId))
            {
                logger.LogWarning("User {UserId} tried to invite user {ReceiverId} who has blocked them",
                    userId, receiverId);
                blockedUsers.Add(receiverId);
            }
        }
        
        if (blockedUsers.Any())
        {
            logger.LogWarning(
                "User {UserId} cannot invite to group {ConversationId}: {Count} blocked users",
                userId, conversationId, blockedUsers.Count);
            return Result<ConversationResponse>.Failure(
                $"Cannot invite users: {string.Join(", ", blockedUsers)}", ErrorTypeEnum.Forbidden);
        }
        
        // ============ DATABASE: Opprett participants ============
        
        foreach (var receiverId in uniqueReceiverIds)
        {
            var newParticipant = new ConversationParticipant
            {
                ConversationId = conversationId,
                UserId = receiverId,
                Status = ConversationStatus.Pending,
                Role = ParticipantRole.Member,
                InvitedAt = DateTime.UtcNow
            };
            conversation.Participants.Add(newParticipant);
        }
        
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "User {UserId} invited {Count} users to group {ConversationId}",
            userId, uniqueReceiverIds.Count, conversationId);
        
        // ============ POST-COMMIT: Systemmelding ============
        
        try
        {
            var inviterName = users.TryGetValue(userId, out var inviter) ? inviter.FullName : "Someone";
            var systemMessage = BuildInviteSystemMessage(inviterName, uniqueReceiverIds, users);
            await messageService.SendSystemMessageAsync(conversationId, systemMessage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
        users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after inviting", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SignalR, SyncEvents, Notifications ============
        
        var otherAcceptedMemberIds = conversation.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        // SyncEvent for inviterende bruker
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.GroupInfoUpdated,
                conversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for inviter {UserId}", userId);
        }
        
        // Notifiser eksisterende medlemmer
        if (otherAcceptedMemberIds.Any())
        {
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                try
                {
                    var signalRTask = hubContext.Clients.User(memberId)
                        .SendAsync("GroupMembersInvited", new { Conversation = conversationResponse });
                    
                    var syncTask = syncService.CreateSyncEventsAsync(
                        [memberId],
                        SyncEventType.GroupInfoUpdated,
                        conversationResponse);
                    
                    await Task.WhenAll(signalRTask, syncTask);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "Failed to notify member {MemberId} about invites to group {ConversationId}",
                        memberId, conversationId);
                }
            });
            
            await Task.WhenAll(memberTasks);
        }
        
        // Notifiser inviterte brukere
        var inviteTasks = uniqueReceiverIds.Select(async receiverId =>
        {
            try
            {
                var signalRTask = hubContext.Clients.User(receiverId)
                    .SendAsync("GroupInviteReceived", new { Conversation = conversationResponse });
                
                var notificationTask = messageNotificationService.CreatePendingConversationNotificationAsync(
                    receiverId, userId, conversationResponse);
                
                var syncTask = syncService.CreateSyncEventsAsync(
                    [receiverId],
                    SyncEventType.GroupInviteReceived,
                    conversationResponse);
                
                await Task.WhenAll(signalRTask, notificationTask, syncTask);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Failed to notify invited user {ReceiverId} for group {ConversationId}",
                    receiverId, conversationId);
            }
        });
        
        await Task.WhenAll(inviteTasks);
        
        logger.LogInformation(
            "User {UserId} successfully invited {InviteCount} users to group {ConversationId}. " +
            "Notified {MemberCount} existing members.",
            userId, uniqueReceiverIds.Count, conversationId, otherAcceptedMemberIds.Count);
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
    
    /// <summary>
    /// Bygger systemmelding for invitasjoner.
    /// Format: "{inviter} invited {user1}, {user2} to the group" (opptil 2 navn)
    /// Eller: "{inviter} invited {user1}, {user2} and {X} others to the group" (flere enn 2)
    /// </summary>
    private static string BuildInviteSystemMessage(
        string inviterName, 
        List<string> invitedUserIds, 
        Dictionary<string, UserSummaryDto> users)
    {
        var invitedNames = invitedUserIds
            .Select(id => users.TryGetValue(id, out var user) ? user.FullName : "Someone")
            .ToList();
        
        return invitedNames.Count switch
        {
            1 => $"{inviterName} invited {invitedNames[0]} to the group",
            2 => $"{inviterName} invited {invitedNames[0]} and {invitedNames[1]} to the group",
            _ => $"{inviterName} invited {invitedNames[0]}, {invitedNames[1]} and {invitedNames.Count - 2} others to the group"
        };
    }
}
