using AFBack.Cache;
using AFBack.Common;
using AFBack.Common.Results;
using AFBack.Features.Broadcast.Services;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Extensions;
using AFBack.Features.Messaging.Interface;
using AFBack.Features.Messaging.Repository;
using AFBack.Models.Enums;

namespace AFBack.Features.Messaging.Services;

public class MessageQueryService(
    ILogger<MessageQueryService> logger,
    IMessageRepository messageRepository,
    IUserSummaryCacheService userSummariesCache,
    IDeleteMessageBroadcastService deleteMessageBroadcastService) : IMessageQueryService
{
    // ======================================== GET MESSAGES ========================================
    
    // Sjekk interface for summary
    public async Task<Result<MessagesResponse>> GetMessagesAsync(
        string userId, int conversationId, int page, int pageSize)
    {
        logger.LogDebug(
            "User {UserId} fetching messages for conversation {ConversationId} (Page: {Page}, PageSize: {PageSize})",
            userId, conversationId, page, pageSize);
        
        // ============ HENT ALT I ÉN SPØRRING ============
        
        var queryResult = await messageRepository.GetMessagesWithValidationAsync(
            userId, conversationId, page, pageSize);
        
        // ============ VALIDERING (etter database-kall) ============
        
        // Sjekker at samtalen eksisterer
        if (!queryResult.ConversationExists)
        {
            logger.LogWarning(
                "User {UserId} tried to fetch messages for non-existent conversation {ConversationId}",
                userId, conversationId);
            return Result<MessagesResponse>.Failure(
                "Conversation not found", ErrorTypeEnum.NotFound);
        }
        
        // Validerer at brukeren er medlem av samtalen
        if (queryResult.ParticipantStatus == null)
        {
            logger.LogWarning(
                "User {UserId} tried to fetch messages for conversation {ConversationId} without being a participant",
                userId, conversationId);
            return Result<MessagesResponse>.Failure(
                "Conversation not found", ErrorTypeEnum.Forbidden);
        }
        
        // Sjekker at brukeren har Accepted status
        if (queryResult.ParticipantStatus != ConversationStatus.Accepted)
        {
            logger.LogWarning(
                "User {UserId} tried to fetch messages for conversation {ConversationId} with status {Status}",
                userId, conversationId, queryResult.ParticipantStatus);
            return Result<MessagesResponse>.Failure(
                "You must accept the conversation before viewing messages", ErrorTypeEnum.Forbidden);
        }
        
        // ============ HENT BRUKERINFO FRA CACHE ============
        
        // Samle alle unike bruker-IDer (sendere + parent sendere)
        var userIds = queryResult.Messages
            .Select(m => m.SenderId)
            .Concat(queryResult.Messages.Select(m => m.ParentSenderId))
            .Where(id => id != null)
            .Distinct()
            .Cast<string>()
            .ToList();
        
        var users = await userSummariesCache.GetUserSummariesAsync(userIds);
        
        // ============ BYGG RESPONSE ============
        
        var response = new MessagesResponse
        {
            Messages = queryResult.Messages.Select(m => m.ToResponse(users)).ToList(),
            TotalCount = queryResult.TotalCount,
            Page = page,
            PageSize = pageSize
        };
        
        logger.LogDebug(
            "User {UserId} fetched {Count} messages for conversation {ConversationId} (Total: {Total})",
            userId, response.Messages.Count, conversationId, queryResult.TotalCount);
        
        return Result<MessagesResponse>.Success(response);
    }
    
    // Sjekk interface for summary
    public async Task<Result<Dictionary<int, List<MessageResponse>>>> GetMessagesForConversationsAsync(
        string userId, List<int> conversationIds, int messagesPerConversation)
    {
        logger.LogDebug(
            "User {UserId} fetching messages for {Count} conversations ({MessagesPerConv} per conversation)",
            userId, conversationIds.Count, messagesPerConversation);
        
        if (conversationIds.Count == 0)
            return Result<Dictionary<int, List<MessageResponse>>>.Success(
                new Dictionary<int, List<MessageResponse>>());
        
        // ============ HENT MELDINGER MED VALIDERING I ÉN SPØRRING ============
        
        var messageDtosByConversation = await messageRepository
            .GetMessagesForConversationsWithValidationAsync(userId, conversationIds, messagesPerConversation);
        
        if (messageDtosByConversation.Count == 0)
            return Result<Dictionary<int, List<MessageResponse>>>.Success(
                new Dictionary<int, List<MessageResponse>>());
        
        // ============ HENT BRUKERINFO FRA CACHE ============
        
        // Samle alle unike bruker-IDer fra alle meldinger
        var allUserIds = messageDtosByConversation.Values
            .SelectMany(messages => messages)
            .SelectMany(m => new[] { m.SenderId, m.ParentSenderId })
            .Where(id => id != null)
            .Distinct()
            .Cast<string>()
            .ToList();
        
        var users = await userSummariesCache.GetUserSummariesAsync(allUserIds);
        
        // ============ BYGG RESPONSE ============
        
        var result = messageDtosByConversation.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value.Select(m => m.ToResponse(users)).ToList()
        );
        
        logger.LogDebug(
            "User {UserId} fetched messages for {Count} conversations",
            userId, result.Count);
        
        return Result<Dictionary<int, List<MessageResponse>>>.Success(result);
    }
    
    // ======================================== DELETE MESSAGE ========================================
    
    // Se interface for summary
    public async Task<Result> DeleteMessageAsync(string userId, int messageId)
    {
        logger.LogDebug("User {UserId} attempting to delete message {MessageId}", userId, messageId);
        
        // ============ HENT DATA FOR VALIDERING I ÉN SPØRRING ============
        
        var message = await messageRepository.GetMessageForDeletionAsync(userId, messageId);
        
        // ============ VALIDERING ============
        
        // Sjekk at meldingen eksisterer
        if (message == null)
        {
            logger.LogWarning("User {UserId} tried to delete non-existent message {MessageId}", 
                userId, messageId);
            return Result.Failure(
                "Message not found", ErrorTypeEnum.NotFound);
        }
        
        // Sjekk at meldingen ikke allerede er slettet
        if (message.IsDeleted)
        {
            logger.LogWarning("User {UserId} tried to delete already deleted message {MessageId}", 
                userId, messageId);
            return Result.Failure(
                "Message is already deleted", ErrorTypeEnum.BadRequest);
        }
        
        // Sjekk at brukeren er avsender av meldingen
        if (message.SenderId != userId)
        {
            logger.LogWarning(
                "User {UserId} tried to delete message {MessageId} sent by {SenderId}",
                userId, messageId, message.SenderId);
            return Result.Failure(
                "You can only delete your own messages", ErrorTypeEnum.Forbidden);
        }
        
        // ============ SOFT DELETE ============
        message.IsDeleted = true;
        await messageRepository.SaveChangesAsync();
        
        logger.LogInformation(
            "User {UserId} successfully deleted message {MessageId} in conversation {ConversationId}",
            userId, messageId, message.ConversationId);
        
        // ============ BROADCAST (SignalR + SyncEvents) ============
        
        deleteMessageBroadcastService.QueueDeleteMessageBroadcast(
            messageId, message.ConversationId, userId);
        
        // ============ BYGG RESPONSE ============
        
        return Result.Success();
    }
}
