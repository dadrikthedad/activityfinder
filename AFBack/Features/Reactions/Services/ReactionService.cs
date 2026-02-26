using AFBack.Common.Enum;
using AFBack.Common.Results;
using AFBack.Features.Broadcast.Services.Interfaces;
using AFBack.Features.Messaging.Repository;
using AFBack.Features.Reactions.DTOs.Responses;
using AFBack.Features.Reactions.Enums;
using AFBack.Features.Reactions.Models;
using AFBack.Features.Reactions.Repositories;
using AFBack.Infrastructure.Cache;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Features.Reactions.Services;

public class ReactionService(
    ILogger<ReactionService> logger,
    IReactionBroadcastService reactionBroadcastService,
    ICanSendCache canSendCache,
    IReactionRepository reactionRepository,
    IMessageRepository messageRepository) : IReactionService
{
    /// <inheritdoc />
    public async Task<Result<ReactionAddedResponse>> AddReactionAsync(string userId, int conversationId, int messageId,
        string emoji)
    {
        // ====== Sjekker CanSencCache for om brukeren kan sende ======
        var isInCanSend = await canSendCache.CanUserSendAsync(userId, conversationId);
        if (!isInCanSend)
        {
            logger.LogWarning("UserId {UserId} can not react on messageId {MessageId} in " +
                              "Conversation {ConversationId}", userId, messageId, conversationId);
            return Result<ReactionAddedResponse>.Failure("You do not have permission to react to this message", 
                ErrorTypeEnum.Forbidden);
        }
        
        // Enum-variabelen for å fortelle Response/BroadcastService hvilken handling ble utført
        ReactionAction reactionAction;
        
        // ====== Sjekk eksisterende reaksjon (validerer også at melding er i samtalen) ======
        var reaction = await reactionRepository.GetUserReactionOnMessageAsync(userId, messageId, conversationId);

        if (reaction != null)
        {
            // Lik emoji, den skal slettes (altså toggles)
            if (reaction.Emoji == emoji)
            {
                reactionRepository.RemoveReaction(reaction);
                reactionAction = ReactionAction.Removed;
            }
            else
            {
                // Oppdater eksisterende
                reaction.Emoji = emoji;
                reactionAction = ReactionAction.Updated;
            }
        }
        else
        {
            // Ingen tidligere reaksjon, vi oppretter
            reaction = new Reaction
            {
                UserId = userId,
                MessageId = messageId,
                Emoji = emoji
            };
            reactionAction = ReactionAction.Added;
            
            await reactionRepository.AddReactionAsync(reaction);
        }
        
        // ====== Lagre og håndter feil ======
        // Feil som kan oppstå og vi fanger: Meldingen eksisterer ikke eller meldingen hører til en annen samtale
        // Sparer et databasekall på å fange opp feilen istedenfor å validere i forkant
        try
        {
            await reactionRepository.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            var messageExists = await messageRepository.MessageExistsInConversationAsync(messageId, 
                conversationId);
            if (!messageExists)
            {
                logger.LogWarning("UserId {UserId} reacted on message {MessageId} that does not exist in " +
                                  "conversation {ConversationId}", userId, messageId, conversationId);
                return Result<ReactionAddedResponse>.Failure("Message not found", ErrorTypeEnum.NotFound);
            }

            throw;
        }

        // ====== Broadcast til andre deltakere - removed sender SignalR og fjerner stille ======
        if (reactionAction == ReactionAction.Removed)
            reactionBroadcastService.QueueReactionRemovedBroadcast(userId, conversationId, messageId);
        else
            reactionBroadcastService.QueueReactionBroadcast(userId, conversationId, messageId, 
                reactionAction);

        return Result<ReactionAddedResponse>.Success(new ReactionAddedResponse
        {
            Action = reactionAction
        });
    }
}
