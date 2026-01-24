namespace AFBack.DTOs;
// denne bruker vi for å sende kun brukerens id, navn og profilbilde til å brukes i venneforespørsler, kommentarer, poster osv for å raskt se litt informasjon om brukeren.
// Kan legge til flere ting (skjønn, alder, osv) etterhvert
public class UserSummaryDto
{
    public string Id { get; set; } // Bruker-ID
    public string FullName { get; set; } = string.Empty; // Fornavn + etternavn (eller med mellomnavn)
    public string? ProfileImageUrl { get; set; } // Profilbilde (kan være null hvis ikke satt)
    
    // Logikk for samhandling mellom brukere
    public bool? IsFriend  { get; set; }
    public bool? IsBlocked { get; set; }
    
    public bool? HasBlockedMe { get; set; }
    public long? LastUpdated { get; set; }

}
