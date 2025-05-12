namespace AFBack.Models;
// Brukes for å sjekke om en bruker ønsker å prate med en annen bruker
public class MessageRequest
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    
    public int? ConversationId { get; set; } // Null for 1-til-1, ellers gruppesamtale
    
    public Conversation? Conversation { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public bool IsAccepted { get; set; } = false;
    
    public bool LimitReached { get; set; } = false; // Maks 5 meldinger før bruker ikke får lov til å spamme mottaker lenger
    
    public bool IsRead { get; set; } = false;
    public User Sender { get; set; } = null!;
}