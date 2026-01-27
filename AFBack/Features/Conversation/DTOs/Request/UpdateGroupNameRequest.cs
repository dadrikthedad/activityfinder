using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

public class UpdateGroupNameRequest
{   
    [Required(ErrorMessage = "Group name is required")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Group name must be between 1-100 characters")]
    public string GroupName { get; set; } = null!;

}
