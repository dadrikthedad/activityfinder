using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.DTOs.Request;

public class GetMessagesForConversationsRequest
{
    [Required(ErrorMessage = "ConversationIds is required")]
    [MinLength(1, ErrorMessage = "At least one conversation ID is required")]
    [MaxLength(50, ErrorMessage = "Maximum 50 conversations per request")]
    public List<int> ConversationIds { get; set; } = [];
    
    [Range(1, 100, ErrorMessage = "MessagesPerConversation must be between 1 and 100")]
    public int MessagesPerConversation { get; set; } = 20;
}
