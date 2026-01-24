namespace AFBack.Features.Messaging.DTOs.Response;

/// <summary>
/// Response på SendMessage - rask og enkel DTO for å ikke returnere alle felt til frontend
/// </summary>
public class AttachmentResponse
{
    public int Id { get; set; }
    public string? OptimisticId { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
}
