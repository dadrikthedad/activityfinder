using AFBack.Features.Conversation.Enums;

namespace AFBack.Features.Messaging.DTOs;

/// <summary>
/// Kombinert resultat fra GetMessagesWithValidationAsync for å redusere databasekall.
/// Inneholder all data som trengs for både validering og respons.
/// </summary>
public class ConversationMessagesDto
{
    /// <summary>
    /// Om samtalen eksisterer i databasen
    /// </summary>
    public bool ConversationExists { get; init; }
    
    /// <summary>
    /// Brukerens status i samtalen (null hvis ikke deltaker)
    /// </summary>
    public ConversationStatus? ParticipantStatus { get; init; }
    
    /// <summary>
    /// Paginerte meldinger for samtalen
    /// </summary>
    public List<MessageDto> Messages { get; init; } = [];
    
    /// <summary>
    /// Totalt antall meldinger i samtalen (for paginering)
    /// </summary>
    public int TotalCount { get; init; }
}
