
using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Conversation.DTOs.Request;

public class ConversationSearchRequest
{
    [Required(AllowEmptyStrings = false, ErrorMessage = "Query is required")]
    [MinLength(1, ErrorMessage = "Query cannot be empty")]
    [MaxLength(100, ErrorMessage = "Query cannot exceed 100 characters")]
    public string Query { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Page is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Page must be greater than 0")]
    public int Page { get; set; }
    
    [Required(ErrorMessage = "PageSize is required")]
    [Range(1, 100, ErrorMessage = "Page must be between 1 and 100")]
    public int PageSize { get; set; } = 20;
}
