using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

// Sendes fra frontend
public class SendGroupRequestsDTO
{
    public int? ConversationId { get; set; } // Null for ny gruppe
    
    [MaxLength(100)]
    public string? GroupName { get; set; } // Påkrevd for nye grupper
    
    [MaxLength(512)]
    public string? GroupImageUrl { get; set; }
    
    [MaxLength(1000)]
    public string? InitialMessage { get; set; }
    
    [Required]
    public List<int> InvitedUserIds { get; set; } = new();
}