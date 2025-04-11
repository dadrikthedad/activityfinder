using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateContactEmailDTO
{
    [MaxLength(254)]
    public string ContactEmail { get; set; } = string.Empty;
}
