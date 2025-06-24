using AFBack.Models;

namespace AFBack.DTOs;
// denne bruker vi for å sende kun brukerens id, navn og profilbilde til å brukes i venneforespørsler, kommentarer, poster osv for å raskt se litt informasjon om brukeren.
// Kan legge til flere ting (skjønn, alder, osv) etterhvert
public class UserSummaryDTO
{
    public int Id { get; set; } // Bruker-ID
    public string FullName { get; set; } = string.Empty; // Fornavn + etternavn (eller med mellomnavn)
    public string? ProfileImageUrl { get; set; } // Profilbilde (kan være null hvis ikke satt)
    
    public GroupRequestStatus? GroupRequestStatus { get; set; } // For å skille mellom en bruker har godkjent en gruppesamtale eller ikke, kan eventuelt brukes senere til å skille i vanlig samtaler og
    
}