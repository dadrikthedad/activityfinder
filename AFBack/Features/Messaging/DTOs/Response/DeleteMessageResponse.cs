namespace AFBack.Features.Messaging.DTOs.Response;

/// <summary>
/// Response etter vellykket sletting av melding
/// </summary>
public record DeleteMessageResponse
{
    /// <summary>
    /// ID til meldingen som ble slettet
    /// </summary>
    public int MessageId { get; init; }
    
    /// <summary>
    /// ID til samtalen meldingen tilhørte
    /// </summary>
    public int ConversationId { get; init; }
}
