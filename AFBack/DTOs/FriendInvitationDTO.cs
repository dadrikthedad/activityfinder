namespace AFBack.DTOs;
// brukes til å sjekke om bruker har sendt forespørsel og status på forespørsel mellom to brukere
public class FriendInvitationDTO
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime SentAt { get; set; }
}
