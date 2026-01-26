using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

public class InviteGroupMemberRequest
{
    /// <summary>
    /// Brukerene som skal motta gruppeforespørsel
    /// </summary>
    [Required(ErrorMessage = "ReceiverIds is required")]
    [MinLength(1, ErrorMessage = "ReceiverIds cannot be empty")]
    public List<string> ReceiverIds { get; set; } = null!;
    
}
