using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.MessageNotification.Service;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Hubs;
using AFBack.Models.Enums;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.Conversation.Services;

public class GroupConversationService(
    ILogger<GroupConversationService> logger,
    IConversationRepository conversationRepository,
    IConversationLeftRecordRepository conversationLeftRecordRepository,
    ISyncService syncService,
    ISendMessageService messageService,
    IHubContext<UserHub> hubContext,
    IMessageNotificationService messageNotificationService,
    IUserSummaryCacheService userSummariesCache,
    IGroupInviteValidator groupInviteValidator,
    IConversationValidator conversationValidator,
    ISendMessageCache sendMessageCache) : IGroupConversationService
{
    // Sjekk interface for summary
    public async Task<Result<CreateGroupConversationResponse>> CreateGroupConversationAsync(
        string userId, CreateGroupConversationRequest request)
    {
        logger.LogInformation("User {UserId} is attempting to create group conversation with {Count} participants",
            userId, request.ReceiverIds.Count);
        
        // ============ VALIDERING: Creator eksisterer ============
        
        var creatorSummary = await userSummariesCache.GetUserSummaryAsync(userId);
        if (creatorSummary == null)
        {
            logger.LogCritical("Creator {UserId} not found in UserSummary cache", userId);
            return Result<CreateGroupConversationResponse>.Failure("User not found", ErrorTypeEnum.NotFound);
        }
        
        // ============ VALIDERING: Inviterte brukere ============
        
        var validationResult = await groupInviteValidator.ValidateInviteAsync(
            userId,
            request.ReceiverIds);
        
        if (validationResult.IsFailure)
        {
            return Result<CreateGroupConversationResponse>.Failure(validationResult.Error, validationResult.ErrorType);
        }
        
        // ============ DATABASE: Opprett gruppe med kun creator ============
        
        var conversation = new Models.Conversation
        {
            Type = ConversationType.GroupChat,
            GroupName = request.GroupName,
            GroupImageUrl = request.GroupImageUrl,
            GroupDescription = request.GroupDescription
        };
        
        var creatorParticipant = new ConversationParticipant
        {
            UserId = userId,
            Status = ConversationStatus.Accepted,
            Role = ParticipantRole.Creator,
            JoinedAt = DateTime.UtcNow,
            InvitedAt = DateTime.UtcNow
        };
        
        var createdConversation = await conversationRepository
            .CreateConversationWithParticipantsAsync(conversation, [creatorParticipant]);
        
        logger.LogInformation("User {UserId} created group conversation {ConversationId}",
            userId, createdConversation.Id);
        
        // ============ POST-COMMIT: Cache ============
        
        try
        {
            await sendMessageCache.OnCanSendAddedAsync(userId, createdConversation.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add creator to CanSend cache for conversation {ConversationId}",
                createdConversation.Id);
        }
        
        // ============ POST-COMMIT: Systemmeldinger ============
        
        try
        {
            await messageService.SendSystemMessageAsync(createdConversation.Id,
                $"{creatorSummary.FullName} created the group '{request.GroupName}'");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send 'created group' system message for group {ConversationId}",
                createdConversation.Id);
        }
        
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
        
        // ============ INVITER BRUKERE via InviteGroupMembersAsync ============
        
        var inviteRequest = new InviteGroupMemberRequest
        {
            ReceiverIds = request.ReceiverIds
        };
        
        // Validering er allerede gjort, så dette skal ikke feile på validering
        var inviteResult = await InviteGroupMembersAsync(userId, createdConversation.Id, inviteRequest);
        
        if (!inviteResult.IsSuccess)
        {
            logger.LogWarning(
                "Group {ConversationId} created but invitations failed: {Error}",
                createdConversation.Id, inviteResult.Error);
            
            return Result<CreateGroupConversationResponse>.Failure(inviteResult.Error, inviteResult.ErrorType);
        }
        
        // ============ POST-COMMIT: SyncEvent for creator ============
        
        var createGroupConversationResponse = new CreateGroupConversationResponse
        {
            ConversationId = createdConversation.Id,
            Conversation = inviteResult.Value!
        };
        
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
        
        logger.LogInformation(
            "User {UserId} successfully created group {ConversationId} with {Count} participants.",
            userId, createdConversation.Id, request.ReceiverIds.Count);
        
        return Result<CreateGroupConversationResponse>.Success(createGroupConversationResponse);
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> AcceptPendingGroupConversationRequestAsync(
        string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to accept group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationResponse>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = conversationValidator.ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationResponse>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationResponse>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = conversationValidator.ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result<ConversationResponse>.Failure(pendingResult.Error, pendingResult.ErrorType);
        
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
            await sendMessageCache.OnCanSendAddedAsync(userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add user {UserId} to CanSend cache for group {ConversationId}", 
                userId, conversationId);
        }
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation!.Participants
            .Select(p => p.UserId)
            .ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var userName = users.TryGetValue(userId, out var user) ? user.FullName : "Someone";
        
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
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = conversationValidator.ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har pending status (ikke allerede akseptert)
        var pendingResult = conversationValidator.ValidateParticipantPending(userParticipant);
        if (pendingResult.IsFailure)
            return Result.Failure(
                "You are already a member of this group. Use the leave endpoint instead.", 
                pendingResult.ErrorType);
        
        // ============ DATABASE: Opprett ConversationLeftRecord og fjern participant ============
        
        // Hent andre godkjente medlemmer FØR vi fjerner participant
        var otherAcceptedMemberIds = conversation!.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        var leftRecord = new ConversationLeftRecord
        {
            UserId = userId,
            ConversationId = conversationId
        };
        
        await conversationLeftRecordRepository.CreateAsync(leftRecord);
        await conversationRepository.RemoveParticipantAsync(userParticipant);
        
        logger.LogInformation("User {UserId} successfully rejected group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation.Participants
            .Where(p => p.UserId != userId) // Ekskluder brukeren som avviste
            .Select(p => p.UserId)
            .ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var userName = (await userSummariesCache.GetUserSummaryAsync(userId))?.FullName ?? "Someone";
        
        // Send systemmelding om at brukeren avviste invitasjonen
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, $"{userName} declined the invitation");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after rejecting", conversationId);
            return Result.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SignalR, SyncEvents, Notifications ============
        
        // SyncEvent for brukeren som avviste
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
        
        // Varsle andre godkjente medlemmer om at brukeren avviste
        if (otherAcceptedMemberIds.Any())
        {
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                try
                {
                    var signalRTask = hubContext.Clients.User(memberId)
                        .SendAsync("GroupMemberDeclined", new { Conversation = conversationResponse });
                    
                    // TODO: Implementer denne metoden i IMessageNotificationService
                    // var notificationTask = messageNotificationService.CreateGroupMemberDeclinedNotificationAsync(
                    //     memberId, userId, conversationResponse);
                    
                    var syncTask = syncService.CreateSyncEventsAsync(
                        [memberId],
                        SyncEventType.GroupInviteDeclined,
                        conversationResponse);
                    
                    await Task.WhenAll(signalRTask, syncTask);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, 
                        "Failed to notify member {MemberId} about user {UserId} declining group {ConversationId}",
                        memberId, userId, conversationId);
                }
            });
            
            await Task.WhenAll(memberTasks);
        }
        
        logger.LogInformation(
            "User {UserId} successfully rejected group {ConversationId}. Notified {MemberCount} other members.",
            userId, conversationId, otherAcceptedMemberIds.Count);
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> InviteGroupMembersAsync(
        string userId, int conversationId, InviteGroupMemberRequest request)
    {
        logger.LogInformation(
            "User {UserId} is attempting to invite {Count} users to group {ConversationId}",
            userId, request.ReceiverIds.Count, conversationId);
        
        // ============ VALIDERING ============
        
        // Henter samtalen
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker samtalen esksiterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationResponse>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = conversationValidator.ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationResponse>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er meldem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationResponse>.Failure(participantResult.Error, participantResult.ErrorType);
        
        // Brukeren som inviterer sin ConversationParticipant
        var inviterParticipant = participantResult.Value!;
        
        // Sjekker at vi har godkjent samtalen
        var acceptedResult = conversationValidator.ValidateParticipantAccepted(inviterParticipant);
        if (acceptedResult.IsFailure)
            return Result<ConversationResponse>.Failure(
                "You must accept the group invitation before inviting others", acceptedResult.ErrorType);
        
        // ============ VALIDERING: Inviterte brukere ============
        
        // Henter brukernme som allerede er eksisterende brukere
        var existingParticipantIds = conversation!.Participants
            .Select(p => p.UserId)
            .ToHashSet();
        
        // Validerer de inviterte brukerne
        var inviteValidationResult = await groupInviteValidator.ValidateInviteAsync(
            userId,
            request.ReceiverIds,
            conversationId,
            existingParticipantIds);
        
        if (inviteValidationResult.IsFailure)
            return Result<ConversationResponse>.Failure(
                inviteValidationResult.Error, inviteValidationResult.ErrorType);
        
        // ============ DATABASE: Opprett participants ============
        
        var uniqueReceiverIds = request.ReceiverIds.Distinct().ToList();
        
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
        
        var allUserIds = new List<string> { userId };
        allUserIds.AddRange(uniqueReceiverIds);
        var users = await userSummariesCache.GetUserSummariesAsync(allUserIds);
        
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
            _ => $"{inviterName} invited {invitedNames[0]}, {invitedNames[1]} and {invitedNames.Count - 2} " +
                 $"others to the group"
        };
    }
    
    // Sjekk interface for summary
    public async Task<Result> LeaveGroupConversationAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to leave group {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = conversationValidator.ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har Accepted status (er faktisk medlem, ikke pending)
        var acceptedResult = conversationValidator.ValidateParticipantAccepted(userParticipant);
        if (acceptedResult.IsFailure)
            return Result.Failure(
                "You must accept the group invitation before you can leave. Use reject endpoint instead.", 
                acceptedResult.ErrorType);
        
        // ============ SJEKK CREATOR SCENARIO ============
        
        var isCreator = userParticipant.Role == ParticipantRole.Creator;
        ConversationParticipant? newCreator = null;
        
        if (isCreator)
        {
            // Finn neste kandidat for Creator-rollen (eldste inviterte med Accepted status)
            newCreator = await conversationRepository.GetNextCreatorCandidateAsync(conversationId, userId);
            
            if (newCreator == null)
            {
                // Ingen andre Accepted medlemmer - disband gruppen
                logger.LogInformation(
                    "Creator {UserId} is leaving group {ConversationId} with no other accepted members. Disbanding group.",
                    userId, conversationId);
                
                await DisbandGroupAsync(userId, conversation!);
                
                return Result.Success();
            }
            
            // Overfør Creator-rollen til neste kandidat
            newCreator.Role = ParticipantRole.Creator;
            
            logger.LogInformation(
                "Transferring Creator role from {OldCreator} to {NewCreator} in group {ConversationId}",
                userId, newCreator.UserId, conversationId);
        }
        
        // ============ DATABASE: Opprett ConversationLeftRecord og fjern participant ============
        
        // Hent andre godkjente medlemmer FØR vi fjerner participant
        var otherAcceptedMemberIds = conversation!.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        var leftRecord = new ConversationLeftRecord
        {
            UserId = userId,
            ConversationId = conversationId
        };
        
        await conversationLeftRecordRepository.CreateAsync(leftRecord);
        await conversationRepository.RemoveParticipantAsync(userParticipant);
        
        logger.LogInformation("User {UserId} successfully left group {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Cache ============
        
        try
        {
            await sendMessageCache.OnCanSendRemovedAsync(userId, conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to remove user {UserId} from CanSend cache for group {ConversationId}", 
                userId, conversationId);
        }
        
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation.Participants
            .Where(p => p.UserId != userId) // Ekskluder brukeren som forlot
            .Select(p => p.UserId)
            .ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var userName = (await userSummariesCache.GetUserSummaryAsync(userId))?.FullName ?? "Someone";
        var newCreatorName = newCreator != null && users.TryGetValue(newCreator.UserId, out var newCreatorUser) 
            ? newCreatorUser.FullName 
            : null;
        
        // ============ SYSTEMMELDING ============
        
        try
        {
            var systemMessage = newCreatorName != null
                ? $"{userName} left the group. {newCreatorName} is now the group leader"
                : $"{userName} left the group";
            
            await messageService.SendSystemMessageAsync(conversationId, systemMessage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after leaving", conversationId);
            return Result.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SignalR, SyncEvents ============
        
        // SyncEvent for brukeren som forlot (til andre enheter)
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationLeft,
                conversationId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for user {UserId} leaving group {ConversationId}", 
                userId, conversationId);
        }
        
        // Varsle gjenstående medlemmer om at brukeren forlot
        if (otherAcceptedMemberIds.Any())
        {
            var memberTasks = otherAcceptedMemberIds.Select(async memberId =>
            {
                try
                {
                    var signalRTask = hubContext.Clients.User(memberId)
                        .SendAsync("GroupMemberLeft", new { Conversation = conversationResponse });
                    
                    // TODO: Implementer denne metoden i IMessageNotificationService
                    // var notificationTask = messageNotificationService.CreateGroupMemberLeftNotificationAsync(
                    //     memberId, userId, conversationResponse);
                    
                    var syncTask = syncService.CreateSyncEventsAsync(
                        [memberId],
                        SyncEventType.GroupMemberLeft,
                        conversationResponse);
                    
                    await Task.WhenAll(signalRTask, syncTask);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, 
                        "Failed to notify member {MemberId} about user {UserId} leaving group {ConversationId}",
                        memberId, userId, conversationId);
                }
            });
            
            await Task.WhenAll(memberTasks);
        }
        
        logger.LogInformation(
            "User {UserId} successfully left group {ConversationId}. Notified {MemberCount} remaining members." +
            (newCreator != null ? " New creator: {NewCreatorId}" : ""),
            userId, conversationId, otherAcceptedMemberIds.Count, newCreator?.UserId);
        
        return Result.Success();
    }

    /// <summary>
    /// Disbander en gruppesamtale. Setter IsDisbanded=true, sletter alle CanSend-records,
    /// og sletter alle ConversationLeftRecords. Sender ingen SignalR/SyncEvents/Notifications til andre.
    /// </summary>
    /// <param name="userId"></param>
    /// <param name="conversation">Samtalen med tracking for å endre egenskapene</param>
    private async Task DisbandGroupAsync(string userId, Models.Conversation conversation)
    {
        // Fjern alle brukerne fra sendMessageCache
        await sendMessageCache.RemoveAllUsersFromConversationAsync(conversation.Id);
        
        // Sett samtalen som disbanded
        conversation.IsDisbanded = true;
        conversation.DisbandedAt = DateTime.UtcNow;

        await conversationRepository.SaveChangesAsync();
        
        // Slett alle ConversationLeftRecords for samtalen
        var deletedLeftRecordsCount = await conversationLeftRecordRepository
            .DeleteAllByConversationIdAsync(conversation.Id);
        logger.LogInformation("Deleted {Count} ConversationLeftRecords for disbanded group {ConversationId}",
            deletedLeftRecordsCount, conversation.Id);
        
        // Opprett SyncEvent kun for creator som forlater (til andre enheter)
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.ConversationLeft,
                conversation.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "Failed to create sync event for creator {UserId} leaving disbanded group {ConversationId}",
                userId, conversation.Id);
        }
        
        logger.LogInformation(
            "Group {ConversationId} has been disbanded by creator {CreatorUserId}",
            conversation.Id, userId);
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationLeftRecordsResponse>> GetLeftConversationsAsync(
        string userId, int page, int pageSize)
    {
        logger.LogInformation("User {UserId} is fetching left conversations (Page: {Page}, PageSize: {PageSize})",
            userId, page, pageSize);
        
        var records = await conversationLeftRecordRepository
            .GetByUserIdPaginatedAsync(userId, page, pageSize);
        
        var totalCount = await conversationLeftRecordRepository.GetCountByUserIdAsync(userId);
        
        var response = new ConversationLeftRecordsResponse
        {
            Records = records.Select(r => new ConversationLeftRecordResponse
            {
                ConversationId = r.ConversationId,
                GroupName = r.Conversation.GroupName,
                GroupImageUrl = r.Conversation.GroupImageUrl,
                LeftAt = r.LeftAt
            }).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
        
        logger.LogInformation("User {UserId} fetched {Count} left conversations (Total: {Total})",
            userId, response.Records.Count, totalCount);
        
        return Result<ConversationLeftRecordsResponse>.Success(response);
    }
    
    // Sjekk interface for summary
    public async Task<Result> DeleteLeftConversationRecordAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to delete left record for conversation {ConversationId}",
            userId, conversationId);
        
        var record = await conversationLeftRecordRepository.GetAsync(userId, conversationId);
        
        if (record == null)
        {
            logger.LogWarning("User {UserId} tried to delete non-existent left record for conversation {ConversationId}",
                userId, conversationId);
            return Result.Failure("Left record not found", ErrorTypeEnum.NotFound);
        }
        
        await conversationLeftRecordRepository.DeleteAsync(record);
        
        logger.LogInformation("User {UserId} successfully deleted left record for conversation {ConversationId}",
            userId, conversationId);
        
        return Result.Success();
    }
    
    // Sjekk interface for summary
    public async Task<Result<ConversationResponse>> UpdateGroupNameAsync(
        string userId, int conversationId, UpdateGroupNameRequest request)
    {
        logger.LogInformation("User {UserId} is attempting to update name for group {ConversationId}",
            userId, conversationId);
        
        // ============ VALIDERING ============
        
        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);
        
        // Sjekker at samtalen eksisterer
        var conversationResult = conversationValidator.ValidateConversationExists(userId, conversationId, conversation);
        if (conversationResult.IsFailure)
            return Result<ConversationResponse>.Failure(conversationResult.Error, conversationResult.ErrorType);
        
        // Validerer at det er en gruppesamtale
        var groupChatResult = conversationValidator.ValidateIsGroupChat(userId, conversation!);
        if (groupChatResult.IsFailure)
            return Result<ConversationResponse>.Failure(groupChatResult.Error, groupChatResult.ErrorType);
        
        // Validerer at brukeren er medlem av samtalen
        var participantResult = conversationValidator.ValidateParticipant(userId, conversation!);
        if (participantResult.IsFailure)
            return Result<ConversationResponse>.Failure(participantResult.Error, participantResult.ErrorType);
        
        var userParticipant = participantResult.Value!;
        
        // Sjekker at brukeren har Accepted status
        var acceptedResult = conversationValidator.ValidateParticipantAccepted(userParticipant);
        if (acceptedResult.IsFailure)
            return Result<ConversationResponse>.Failure(acceptedResult.Error, acceptedResult.ErrorType);
        
        // Sjekker at brukeren er Creator
        var creatorResult = conversationValidator.ValidateIsCreator(userParticipant);
        if (creatorResult.IsFailure)
            return Result<ConversationResponse>.Failure(creatorResult.Error, creatorResult.ErrorType);
        
        // ============ DATABASE: Oppdater gruppenavn ============
        
        var oldGroupName = conversation!.GroupName;
        conversation.GroupName = request.GroupName;
        
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "User {UserId} updated group {ConversationId} name from '{OldName}' to '{NewName}'",
            userId, conversationId, oldGroupName, request.GroupName);
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation.Participants
            .Select(p => p.UserId)
            .ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var userName = users.TryGetValue(userId, out var user) ? user.FullName : "Someone";
        
        // ============ POST-COMMIT: Systemmelding ============
        
        try
        {
            var systemMessage = $"{userName} changed the group name to '{request.GroupName}'";
            
            await messageService.SendSystemMessageAsync(conversationId, systemMessage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group name update {ConversationId}",
                conversationId);
        }
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after updating name", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: SignalR, SyncEvents, Notifications ============
        
        // Hent alle deltakere med Accepted og Pending status (unntatt brukeren selv)
        var otherParticipantIds = conversation.Participants
            .Where(p => (p.Status == ConversationStatus.Accepted 
                         || p.Status == ConversationStatus.Pending) 
                        && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        // SyncEvent for brukeren som endret navnet (til andre enheter)
        try
        {
            await syncService.CreateSyncEventsAsync(
                [userId],
                SyncEventType.GroupInfoUpdated,
                conversationResponse);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create sync event for user {UserId} updating group name", userId);
        }
        
        // Varsle alle andre deltakere (Accepted og Pending)
        if (otherParticipantIds.Any())
        {
            var participantTasks = otherParticipantIds.Select(async participantId =>
            {
                try
                {
                    var signalRTask = hubContext.Clients.User(participantId)
                        .SendAsync("GroupNameUpdated", new { Conversation = conversationResponse });
                    
                    // TODO: Implementer denne metoden i IMessageNotificationService
                    // var notificationTask = messageNotificationService.CreateGroupNameUpdatedNotificationAsync(
                    //     participantId, userId, conversationResponse);
                    
                    var syncTask = syncService.CreateSyncEventsAsync(
                        [participantId],
                        SyncEventType.GroupInfoUpdated,
                        conversationResponse);
                    
                    await Task.WhenAll(signalRTask, syncTask);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "Failed to notify participant {ParticipantId} about group name update {ConversationId}",
                        participantId, conversationId);
                }
            });
            
            await Task.WhenAll(participantTasks);
        }
        
        logger.LogInformation(
            "User {UserId} successfully updated group {ConversationId} name. Notified {Count} other participants.",
            userId, conversationId, otherParticipantIds.Count);
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
}
