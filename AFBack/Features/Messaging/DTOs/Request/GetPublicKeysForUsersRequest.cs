using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Messaging.DTOs.Request;

public class GetPublicKeysForUsersRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "At least one User ID is required")]
    public List<string> UserIds { get; set; } = [];
}
