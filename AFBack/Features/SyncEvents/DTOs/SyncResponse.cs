namespace AFBack.Features.SyncEvents.DTOs;

public class SyncResponse
{
    public List<SyncEventResponse> Events { get; set; } = new();
    public bool RequiresFullRefresh { get; set; }
}
