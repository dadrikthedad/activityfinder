using System.ComponentModel.DataAnnotations;
using AFBack.Common.DTOs;

namespace AFBack.Features.Friendship.DTOs.Requests;

public class SearchFriendRequest
{   
    [Required(ErrorMessage = "Search query is required")]
    [MinLength(2, ErrorMessage = "Search query must be at least 2 characters")]
    [MaxLength(100, ErrorMessage = "Search query cannot exceed 100 characters")]
    public string Query { get; init => field = value.Trim(); } = string.Empty;
    
    public PaginationRequest PaginationRequest { get; set; } = new();
}
