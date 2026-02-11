using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.DTOs;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Extensions;
using AFBack.Features.Conversation.Models;
using AFBack.Features.Conversation.Repository;
using AFBack.Features.Conversation.Validators;
using AFBack.Features.MessageNotification.Models.Enum;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.SyncEvents.Enums;
using AFBack.Features.SyncEvents.Services;
using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.Services;

public class GroupConversationService(
    ILogger<GroupConversationService> logger,
    IConversationRepository conversationRepository,
    IConversationLeftRecordRepository conversationLeftRecordRepository,
    ISyncService syncService,
    ISendMessageService messageService,
    IGroupConversationBroadcastService groupBroadcastService,
    IUserSummaryCacheService userSummariesCache,
    IGroupInviteValidator groupInviteValidator,
    IConversationValidator conversationValidator,
    ISendMessageCache sendMessageCache) : IGroupConversationService
{
    /// <inheritdoc />
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
        
      
        await sendMessageCache.OnCanSendAddedAsync(userId, createdConversation.Id);
   
        
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
    
    /// <inheritdoc />
    public async Task<Result<ConversationResponse>> AcceptPendingGroupConversationRequestAsync(
        string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to accept group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============

        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);

        var validationResult = conversationValidator.ValidatePendingGroupInviteAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result<ConversationResponse>.Failure(validationResult.Error, validationResult.ErrorType);

        var userParticipant = validationResult.Value!;
        
        // ============ DATABASE: Oppdater participant ============
        
        userParticipant.Status = ConversationStatus.Accepted;
        userParticipant.Role = ParticipantRole.Member;
        userParticipant.JoinedAt = DateTime.UtcNow;
        
        await conversationRepository.SaveChangesAsync();
        
        logger.LogInformation("User {UserId} successfully accepted group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ POST-COMMIT: Cache ============
        
        await sendMessageCache.OnCanSendAddedAsync(userId, conversationId);
      
        
        // ============ HENT DATA FOR RESPONSE ============
        
        var allParticipantIds = conversation!.Participants
            .Select(p => p.UserId)
            .ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after accepting", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }

        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: Broadcast ============
        
        var otherAcceptedMemberIds = conversation.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        // Hent UserSummary for brukeren som joiner
        var joiningUserSummary = users.GetValueOrDefault(userId) ?? new UserSummaryDto();

        // Bygg summary (samme som systemmelding)
        var summary = $"{joiningUserSummary.FullName} joined the group";

        // Systemmelding
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }

        // Broadcast
        await groupBroadcastService.BroadcastGroupInviteAcceptedAsync(
            userId, 
            otherAcceptedMemberIds, 
            conversationResponse,
            summary,
            joiningUserSummary);
        
        
        logger.LogInformation(
            "User {UserId} successfully joined group {ConversationId}. Notified {MemberCount} other members.",
            userId, conversationId, otherAcceptedMemberIds.Count);
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
    
    /// <inheritdoc />
    public async Task<Result> RejectPendingGroupConversationRequestAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to reject group invitation {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============

        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);

        var validationResult = conversationValidator.ValidatePendingGroupInviteAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result.Failure(validationResult.Error, validationResult.ErrorType);

        var userParticipant = validationResult.Value!;
        
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
    
        // Hent alle brukere inkludert den som avviste
        var allUserIds = conversation.Participants.Select(p => p.UserId).ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allUserIds);
    
        var decliningUserSummary = users.GetValueOrDefault(userId) ?? new UserSummaryDto();
    
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after rejecting", conversationId);
            return Result.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
    
        // Ekskluder brukeren som avviste fra response
        var usersForResponse = users
            .Where(u => u.Key != userId)
            .ToDictionary(u => u.Key, u => u.Value);
    
        var conversationResponse = conversationDto.ToResponse(usersForResponse);
        
        // ============ POST-COMMIT: Systemmelding og Broadcast ============
    
        // Bygg summary (én gang - brukes til både systemmelding og notification)
        var summary = $"{decliningUserSummary.FullName} declined the invitation";
    
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
           
        await groupBroadcastService.BroadcastGroupInviteDeclinedAsync(userId, otherAcceptedMemberIds, 
            conversationResponse, summary, decliningUserSummary);

        
        logger.LogInformation(
            "User {UserId} successfully rejected group {ConversationId}. Notified {MemberCount} other members.",
            userId, conversationId, otherAcceptedMemberIds.Count);
        
        return Result.Success();
    }
    
    /// <inheritdoc />
    public async Task<Result<ConversationResponse>> InviteGroupMembersAsync(
        string userId, int conversationId, InviteGroupMemberRequest request)
    {
        logger.LogInformation(
            "User {UserId} is attempting to invite {Count} users to group {ConversationId}",
            userId, request.ReceiverIds.Count, conversationId);
        
        // ============ VALIDERING ============

        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);

        var validationResult = conversationValidator.ValidateGroupMemberAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result<ConversationResponse>.Failure(validationResult.Error, validationResult.ErrorType);
        
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
        
        // ============ HENT DATA FOR RESPONSE ============
    
        var allParticipantIds = conversation.Participants.Select(p => p.UserId).ToList();
        var users = await userSummariesCache.GetUserSummariesAsync(allParticipantIds);
    
        var inviterUserSummary = users.GetValueOrDefault(userId) ?? new UserSummaryDto();
    
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after inviting", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
    
        var conversationResponse = conversationDto.ToResponse(users);
        
        // ============ POST-COMMIT: Systemmelding og Broadcast ============
    
        // Bygg summary (samme som systemmelding)
        var summary = BuildInviteSystemMessage(inviterUserSummary.FullName, uniqueReceiverIds, users);
    
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        var otherAcceptedMemberIds = conversation.Participants
            .Where(p => p.Status == ConversationStatus.Accepted && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        await groupBroadcastService.BroadcastGroupInvitesSentAsync(userId, uniqueReceiverIds, otherAcceptedMemberIds, 
            conversationResponse, summary, inviterUserSummary);
        
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
    
    /// <inheritdoc />
    public async Task<Result> LeaveGroupConversationAsync(string userId, int conversationId)
    {
        logger.LogInformation("User {UserId} is attempting to leave group {ConversationId}", 
            userId, conversationId);
        
        // ============ VALIDERING ============

        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);

        var validationResult = conversationValidator.ValidateGroupMemberAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result.Failure(validationResult.Error, validationResult.ErrorType);

        var userParticipant = validationResult.Value!;
        
        // ============ HÅNDTER CREATOR SCENARIO ============
    
        var (shouldDisband, newCreator) = await HandleCreatorLeavingAsync(
            userId, conversationId, userParticipant, conversation!);
    
        if (shouldDisband)
            return Result.Success();
        
        // ============ DATABASE: Opprett ConversationLeftRecord og fjern participant ============
        
        // Hent andre godkjente medlemmer FØR vi fjerner participant
        var remainingMemberIds = conversation!.Participants
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
        
        await sendMessageCache.OnCanSendRemovedAsync(userId, conversationId);
        
        // ============ HENT DATA FOR RESPONSE ============
        
        
        // Henter alle brukere fra cache
        var users = await userSummariesCache.GetUserSummariesAsync(
            conversation.Participants.Select(p => p.UserId).ToList());
        
        // Hent UserSummary for brukeren som forlater
        var leavingUserSummary = users.GetValueOrDefault(userId) ?? new UserSummaryDto();
        
        var newCreatorName = newCreator != null && users.TryGetValue(newCreator.UserId, out var newCreatorUser) 
            ? newCreatorUser.FullName 
            : null;
        
        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after leaving", conversationId);
            return Result.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }
        
        // Ekskluder brukeren som forlot fra response
        var usersForResponse = users
            .Where(u => u.Key != userId)
            .ToDictionary(u => u.Key, u => u.Value);

        var conversationResponse = conversationDto.ToResponse(usersForResponse);
        
        // ============ POST-COMMIT: Systemmelding og Broadcast ============
    
        // Bygg summary - systemmelding og notification
        var summary = newCreatorName != null
            ? $"{leavingUserSummary.FullName} left the group. {newCreatorName} is now the group leader"
            : $"{leavingUserSummary.FullName} left the group";
    
        try
        {
            await messageService.SendSystemMessageAsync(conversationId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group {ConversationId}", conversationId);
        }
        
        await groupBroadcastService.BroadcastGroupMemberLeftAsync(userId, remainingMemberIds, conversationResponse,
            summary, leavingUserSummary);
        
        logger.LogInformation(
            "User {UserId} successfully left group {ConversationId}. Notified {MemberCount} remaining members." +
            (newCreator != null ? " New creator: {NewCreatorId}" : ""),
            userId, conversationId, remainingMemberIds.Count, newCreator?.UserId);
        
        return Result.Success();
    }
    
    /// <summary>
    /// Håndterer creator-scenario når bruker forlater gruppe.
    /// Returnerer ny creator hvis rollen overføres, eller null hvis gruppen skal disbandes.
    /// </summary>
    /// <returns>Tuple med (shouldDisband, newCreator)</returns>
    private async Task<(bool ShouldDisband, ConversationParticipant? NewCreator)> HandleCreatorLeavingAsync(
        string userId, int conversationId, ConversationParticipant userParticipant, Models.Conversation conversation)
    {
        if (userParticipant.Role != ParticipantRole.Creator)
            return (false, null);
    
        var newCreator = await conversationRepository.GetNextCreatorCandidateAsync(conversationId, userId);
    
        if (newCreator == null)
        {
            logger.LogInformation(
                "Creator {UserId} is leaving group {ConversationId} with no other accepted members. Disbanding group.",
                userId, conversationId);
        
            await DisbandGroupAsync(userId, conversation);
            return (true, null);
        }
    
        newCreator.Role = ParticipantRole.Creator;
    
        logger.LogInformation(
            "Transferring Creator role from {OldCreator} to {NewCreator} in group {ConversationId}",
            userId, newCreator.UserId, conversationId);
    
        return (false, newCreator);
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
    
    /// <inheritdoc />
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
    
    /// <inheritdoc />
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
    
    /// <inheritdoc />
    public async Task<Result<ConversationResponse>> UpdateGroupNameAsync(
        string userId, int conversationId, UpdateGroupNameRequest request)
    {
        logger.LogInformation("User {UserId} is attempting to update name for group {ConversationId}",
            userId, conversationId);
        
        // ============ VALIDERING ============

        var conversation = await conversationRepository.GetConversationWithTrackingAsync(conversationId);

        var validationResult = conversationValidator.ValidateGroupCreatorAction(userId, conversationId, conversation);
        if (validationResult.IsFailure)
            return Result<ConversationResponse>.Failure(validationResult.Error, validationResult.ErrorType);
        
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

        var updaterUserSummary = users.GetValueOrDefault(userId) ?? new UserSummaryDto();

        var conversationDto = await conversationRepository.GetConversationDtoAsync(conversationId);
        if (conversationDto == null)
        {
            logger.LogCritical("Group conversation {ConversationId} not found after updating name", conversationId);
            return Result<ConversationResponse>.Failure(
                "Failed to retrieve updated conversation", ErrorTypeEnum.InternalServerError);
        }

        var conversationResponse = conversationDto.ToResponse(users);

        // ============ POST-COMMIT: Systemmelding og Broadcast ============

        // Bygg summary (én gang - brukes til både systemmelding og notification)
        var summary = $"{updaterUserSummary.FullName} changed the group name to '{request.GroupName}'";

        try
        {
            await messageService.SendSystemMessageAsync(conversationId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send system message for group name update {ConversationId}",
                conversationId);
        }

        var otherParticipantIds = conversation.Participants
            .Where(p => (p.Status == ConversationStatus.Accepted 
                         || p.Status == ConversationStatus.Pending) 
                        && p.UserId != userId)
            .Select(p => p.UserId)
            .ToList();
        
        await groupBroadcastService.BroadcastGroupInfoUpdatedAsync(userId, otherParticipantIds, conversationResponse,
            summary, updaterUserSummary, GroupEventType.GroupNameChanged, "GroupNameUpdated");
        
        logger.LogInformation(
            "User {UserId} successfully updated group {ConversationId} name. Notified {Count} other participants.",
            userId, conversationId, otherParticipantIds.Count);
        
        return Result<ConversationResponse>.Success(conversationResponse);
    }
}
