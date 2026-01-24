using AFBack.Models.Enums;

namespace AFBack.Features.Conversation.DTOs;

/// <summary>
/// Intern data-modell som representerer participant-data fra databasen. Brukes som mellomformat mellom lagene.
/// ParticipantResponse er det frontend forventer
/// </summary>
public class ParticipantDto
{
    public string UserId { get; set; } = null!;
    public ConversationStatus Status { get; set; }
    public ParticipantRole Role { get; set; }
    public int? PendingMessagesReceived { get; set; }
}
