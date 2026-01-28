using AFBack.Common.Results;
using AFBack.Features.Conversation.Models;

namespace AFBack.Features.Conversation.Validators;

public interface IConversationValidator
{
    // ============ ENKELT-VALIDERINGER ============
    
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
    
    // ============ KOMBINERTE VALIDERINGER ============
    
    /// <summary>
    /// Validerer at brukeren kan akseptere/avvise en pending 1-1 samtaleforespørsel.
    /// Sjekker: samtale eksisterer, er PendingRequest, bruker er participant,
    /// bruker er mottaker (PendingRecipient), og har Pending status.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidatePendingRequestAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren kan akseptere/avvise en gruppeinvitasjon.
    /// Sjekker: samtale eksisterer, er GroupChat, bruker er participant, og har Pending status.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidatePendingGroupInviteAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren kan utføre handlinger på en gruppesamtale som medlem.
    /// Sjekker: samtale eksisterer, er GroupChat, bruker er participant, og har Accepted status.
    /// Brukes for: leave group, invite members.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidateGroupMemberAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren (som Creator) kan utføre admin-handlinger på en gruppesamtale.
    /// Sjekker: samtale eksisterer, er GroupChat, bruker er participant, har Accepted status, og er Creator.
    /// Brukes for: update group name, update group image.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidateGroupCreatorAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren kan arkivere en 1-1 samtale.
    /// Sjekker: samtale eksisterer, bruker er participant, ikke allerede arkivert, og er IKKE gruppesamtale.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidateArchiveAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
    
    /// <summary>
    /// Validerer at brukeren kan gjenopprette en arkivert 1-1 samtale.
    /// Sjekker: samtale eksisterer, bruker er participant, er arkivert, og er IKKE gruppesamtale.
    /// </summary>
    /// <returns>Result med ConversationParticipant ved suksess</returns>
    Result<ConversationParticipant> ValidateRestoreArchiveAction(
        string userId,
        int conversationId,
        Models.Conversation? conversation);
}
