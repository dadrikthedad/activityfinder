using AFBack.Common.DTOs;
using AFBack.Models;

namespace AFBack.DTOs;
// brukes til å sjekke om bruker har sendt forespørsel og status på forespørsel mellom to brukere
public class FriendInvitationDTO
{
    public int Id { get; set; } // ID-en på venneforespørselen
    
    public UserSummaryDto UserSummary { get; set; } = null!; // Henter brukerid, navn og bilde fra brukeren, men istedenfor å sende alt til brukeren så sender vi kun det vi spesifiser i SenderDTO.cs
    public int ReceiverId { get; set; } // Bruker ID på mottakeren
   
    public string Status { get; set; } = "Pending"; // Status på forespørselen
    public DateTime SentAt { get; set; } // Tidspunkt når det var sendt
}
