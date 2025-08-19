using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UploadGroupImageDTO
{
    public IFormFile? File { get; set; }
        
    public int? GroupId { get; set; }
        
    public string? Action { get; set; } // "delete" eller null for upload
}