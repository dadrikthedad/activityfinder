namespace AFBack.DTOs;
// Brukes for å sende en invitasjon til en bruker, og da henter vi kun Id-en til brukeren vi skal sende til
public class SendFriendRequestDTO
{
    public int ReceiverId { get; set; }
}