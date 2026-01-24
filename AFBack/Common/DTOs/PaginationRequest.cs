using System.ComponentModel.DataAnnotations;

namespace AFBack.Common.DTOs;

public class PaginationRequest
{
    [Required(ErrorMessage = "Page is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Page must be greater than 0")]
    public int Page { get; set; } = 1;
    
    [Required(ErrorMessage = "PageSize is required")]
    [Range(1, 100, ErrorMessage = "Page must be between 1 and 100")]
    public int PageSize { get; set; } = 20;
}
