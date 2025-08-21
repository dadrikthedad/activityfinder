namespace AFBack.Models;

public class ReportAttachment
{
    public int Id { get; set; }
    
    // Foreign key til Report
    public Guid ReportId { get; set; }
    
    // Hvor filen ligger
    public string FileUrl { get; set; } = null!;
    
    // Filtype: "image/png", "image/jpeg", "application/pdf" etc.
    public string FileType { get; set; } = null!;
    
    public long? FileSize { get; set; }
    
    // Navnet på filen
    public string? FileName { get; set; }
    
    // Når den ble lastet opp
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public Report Report { get; set; } = null!;
}