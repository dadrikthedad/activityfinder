namespace AFBack.Common.DTOs;

/// <summary>
/// Denne bruker vi for å sende kun brukerens id, navn og profilbilde
/// Kan legge til flere ting (kjønn, alder, osv) etterhvert
/// </summary>
public class UserSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; } // Profilbilde (kan være null hvis ikke satt)
}
