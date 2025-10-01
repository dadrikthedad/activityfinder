using AFBack.Models;

namespace AFBack.Features.MessageBroadcast.DTO.cs;

public class EncryptedMessageSyncEventParticipant
{
    public int Id { get; set; }
    public string FullName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public ConversationStatus? ConversationStatus { get; set; }
}