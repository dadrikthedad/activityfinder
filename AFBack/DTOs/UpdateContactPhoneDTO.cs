using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateContactPhoneDTO
{
    [MaxLength(50)]
    public string ContactPhone { get; set; } = string.Empty;
}