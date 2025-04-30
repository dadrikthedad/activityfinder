namespace AFBack.Models;
// Meldinger mellom en bruker og en annen bruker eller en gruppe
public class Message
{
    // Id til gruppen
    public int Id { get; set; } // Primærnøkkel
    // Avsender ID
    public int SenderId { get; set; } // Bruker som sender
    
    public User Sender { get; set; } = null!; 
    
    // Selve meldingsteksten (kan være tom hvis kun fil f.eks.)
    public string? Text { get; set; } 
    // Liste over vedlegg, liste slik at en bruker kan sende flere vedlegg i en fil
    public List<MessageAttachment> Attachments { get; set; } = new(); 
    // Når meldingen ble sendt
    public DateTime SentAt { get; set; } = DateTime.UtcNow; 
    // For Soft delete
    public bool IsDeleted { get; set; } = false;
    
    // Kobler oss til samtale-Iden for å lett finne samtalen
    public int ConversationId { get; set; }
    // Her refere vi til Conversation-objektet
    public Conversation Conversation { get; set; } = null!;
    // Bruker kan kun se meldinger hvis de godkjenner det
    public bool IsApproved { get; set; } = true; 
    
    public int? ParentMessageId { get; set; } // Valgfri referanse til en annen melding
    public Message? ParentMessage { get; set; } // Navigasjonsfelt

    
    public List<Reaction> Reactions { get; set; } = new();
}