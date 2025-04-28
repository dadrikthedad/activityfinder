namespace AFBack.Models;
// Meldinger mellom en bruker og en annen bruker eller en gruppe
public class Message
{
    // Id til gruppen
    public int Id { get; set; } // Primærnøkkel
    // Avsender ID
    public string SenderId { get; set; } = null!; // Bruker som sender
    // Mottaker Id (kan være null hvis gruppe)
    public string? ReceiverId { get; set; }
    // For gruppe-chat (kan være null hvis privat melding)
    public string? GroupName { get; set; } 
    // Selve meldingsteksten (kan være tom hvis kun fil f.eks.)
    public string? Text { get; set; } 
    // Liste over vedlegg, liste slik at en bruker kan sende flere vedlegg i en fil
    public List<MessageAttachment> Attachments { get; set; } = new(); 
    // Når meldingen ble sendt
    public DateTime SentAt { get; set; } = DateTime.UtcNow; 
}