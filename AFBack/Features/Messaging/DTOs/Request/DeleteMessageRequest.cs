namespace AFBack.Features.Messaging.DTOs.Request;

/// <summary>
/// Request for å slette en melding (soft delete)
/// </summary>
public class DeleteMessageRequest
{
    /// <summary>
    /// ID til meldingen som skal slettes
    /// </summary>
    public int MessageId { get; set; }
}
