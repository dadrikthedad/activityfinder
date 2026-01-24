
using AFBack.Models.Enums;

namespace AFBack.DTOs;

public class ConversationParticipantDto
{
    public UserSummaryDto User { get; set; } = null!;
    public ConversationStatus ConversationStatus { get; set; }
}

