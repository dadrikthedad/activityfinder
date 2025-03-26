using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;

public class UpdateWebsitesDTO
{
    [MaxLength(5, ErrorMessage = "You can only add up to 5 websites.")]
    public List<string> Websites { get; set; } = new();
}