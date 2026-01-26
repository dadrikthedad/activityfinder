using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

public class CreateGroupConversationRequest
{
    /// <summary>
    /// Brukerene som skal motta gruppeforespørsel
    /// </summary>
    [Required(ErrorMessage = "ReceiverId is required")]
    [MinLength(1, ErrorMessage = "ReceiverId cannot be empty")]
    public List<string> ReceiverIds { get; set; } = null!;
    
    [MaxLength(100)]
    public string? GroupName { get; set; } 
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    [MaxLength(1000)]
    public string? GroupDescription { get; set; }
}
