namespace AFBack.DTOs.BoostrapDTO.Sync;

public class SyncEventDto
{
    public int Id { get; set; }
    public string EventType { get; set; }
    public string EventData { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? Source { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? RelatedEntityType { get; set; }
}