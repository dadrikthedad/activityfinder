namespace AFBack.Models;
// Vedlegg til meldinger mellom to brukere eller fra en bruker til en gruppe
public class MessageAttachment
{       
        // Unik ID
        public int Id { get; set; } 
        // Foreign key til Message
        public int MessageId { get; set; }
        // Hvor filen ligger
        public string FileUrl { get; set; } = null!;
        // Filtype for å ha kontroll over hvordan fil det er: F.eks. "image/png", "video/mp4", "application/pdf"
        public string FileType { get; set; } = null!; 
        
        public long? FileSize { get; set; }
        // Navnet på filen må vises
        public string? FileName { get; set; }
        // For å referere til selve beskjeden
        public Message Message;
}
