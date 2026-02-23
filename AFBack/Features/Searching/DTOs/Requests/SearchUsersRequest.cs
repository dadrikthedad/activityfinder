using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Searching.DTOs.Requests;

public class SearchUsersRequest
{
    [Required(ErrorMessage = "Search query is required")]
    [MinLength(2, ErrorMessage = "Search query must be at least 2 characters")]
    [MaxLength(100, ErrorMessage = "Search query cannot exceed 100 characters")]
    public string Query { get; init; } = null!;

    [MaxLength(100)]
    public string? Cursor { get; init; }

    [Range(5, 50, ErrorMessage = "PageSize must be between 5 and 50")]
    public int PageSize { get; init; } = 20;
}
