using AFBack.Common.Results;
using AFBack.Features.Conversation.Models;

namespace AFBack.Features.Conversation.Validators;

public interface IConversationValidator
{
    /// <summary>
    /// Validerer at en samtale eksisterer (ikke null).
    /// </summary>
    Result<Models.Conversation> ValidateConversationExists(
        string userId, 
        int conversationId, 
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren er participant i samtalen og returnerer participant.
    /// </summary>
    Result<ConversationParticipant> ValidateParticipant(
        string userId,
        Models.Conversation conversation);
    
    /// <summary>
    /// Validerer at participant har Accepted status.
    /// </summary>
    Result ValidateParticipantAccepted(ConversationParticipant participant);
    
    /// <summary>
    /// Validerer at participant har Pending status (ikke Accepted eller Rejected).
    /// </summary>
    Result ValidateParticipantPending(ConversationParticipant participant);
    
    /// <summary>
    /// Validerer at samtalen er av typen GroupChat.
    /// </summary>
    Result ValidateIsGroupChat(string userId, Models.Conversation conversation);
    
    /// <summary>
    /// Validerer at samtalen er av typen PendingRequest.
    /// </summary>
    Result ValidateIsPendingRequest(string userId, Models.Conversation conversation);
    
    /// <summary>
    /// Validerer at samtalen ikke er av typen GroupChat.
    /// </summary>
    Result ValidateIsNotGroupChat(string userId, Models.Conversation conversation);
    
    /// <summary>
    /// Validerer at participant ikke har arkivert/slettet samtalen.
    /// </summary>
    Result ValidateNotArchived(ConversationParticipant participant);
    
    /// <summary>
    /// Validerer at participant har arkivert/slettet samtalen.
    /// </summary>
    Result ValidateIsArchived(ConversationParticipant participant);
    
    /// <summary>
    /// Validerer at participant har rollen PendingRecipient.
    /// </summary>
    Result ValidateIsPendingRecipient(ConversationParticipant participant);
    
    /// <summary>
    /// Validerer at en bruker eksisterer (ikke null).
    /// </summary>
    Result ValidateUserExists(string userId, bool exists);
    
    /// <summary>
    /// Validerer at participant har Creator-rollen.
    /// </summary>
    Result ValidateIsCreator(ConversationParticipant participant);
}
