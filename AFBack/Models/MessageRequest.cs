namespace AFBack.Models;
// Brukes for å sjekke om en bruker ønsker å prate med en annen bruker
public class MessageRequest
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public bool IsAccepted { get; set; } = false;
    public User Sender { get; set; } = null!;
}