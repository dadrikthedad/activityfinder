using AFBack.Features.SyncEvents.Enums;

namespace AFBack.Features.SyncEvents.DTOs;

public class SyncEventResponse
{
    public int Id { get; set; }
    public SyncEventType EventType { get; set; }
    public string EventData { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
