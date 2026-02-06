namespace AFBack.Features.SignalR.DTOs.Responses;

/// <summary>
/// Sendes til klienten ved feil under tilkobling.
/// </summary>
public sealed record ConnectionErrorResponse
{
    public required string Error { get; init; }
    public required string Reason { get; init; }
    public required bool ShouldRetry { get; init; }
}
