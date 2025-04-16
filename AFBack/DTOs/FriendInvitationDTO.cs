namespace AFBack.DTOs;
// brukes til å sjekke om bruker har sendt forespørsel og status på forespørsel mellom to brukere
public class FriendInvitationDTO
{
    public int Id { get; set; } // ID-en på venneforespørselen
    public int SenderId { get; set; } // Bruker ID på senderen
    public int ReceiverId { get; set; } // Bruker ID på mottakeren
    
    public string SenderFullName { get; set; } = string.Empty; // Brukerens fullenavn for å vise hvem som har sendt forespørselen til brukeren
    public string Status { get; set; } = "Pending"; // Status på forespørselen
    public DateTime SentAt { get; set; } // Tidspunkt når det var sendt
}
