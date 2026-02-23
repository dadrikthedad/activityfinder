using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

public class UpdateGroupDescriptionRequest
{
    [StringLength(1000, ErrorMessage = "Group description cannot exceed 1000 characters")]
    public string? GroupDescription { get; init => field = value?.Trim(); }
}
