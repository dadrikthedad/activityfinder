using AFBack.Models;

namespace AFBack.Features.MessageBroadcast.DTO.cs;

public class EncryptedMessageSyncEvent
{
    public int Id { get; set; }
    public bool IsGroup { get; set; }
    public string? GroupName { get; set; }
    
    public string? GroupImageUrl { get; set; }
    public DateTime? LastMessageSentAt { get; set; }
    public ICollection<EncryptedMessageSyncEventParticipant>? Participants { get; set; }
}