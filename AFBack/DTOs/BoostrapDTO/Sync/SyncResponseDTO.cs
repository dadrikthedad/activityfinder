namespace AFBack.DTOs.BoostrapDTO.Sync;

public class SyncResponseDTO
{
    public List<SyncEventDto> Events { get; set; } = new();
    public string NewSyncToken { get; set; }
    public bool RequiresFullRefresh { get; set; }
    public string? Message { get; set; }
}