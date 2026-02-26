using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.DTOs.Request;

public class StoreRecoverySeedRequest
{
    [Required(ErrorMessage = "Recovery seed is required")]
    [StringLength(500, MinimumLength = 1, ErrorMessage = "Recovery seed must be between 1 and 500 characters")]
    public string Key { get; set; } = string.Empty;
}
