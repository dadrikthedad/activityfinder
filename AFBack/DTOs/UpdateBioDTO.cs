using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateBioDTO
{
    [MaxLength(1000)]
    public string Bio { get; set; } = string.Empty;
}
