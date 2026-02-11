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
    
    [Required(ErrorMessage = "Group name is required")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Group name cannot be between 1-100 characters")]
    public string GroupName { get; init => field = value.Trim(); } = null!;
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    [MaxLength(1000)]
    public string? GroupDescription { get; set; }
}
