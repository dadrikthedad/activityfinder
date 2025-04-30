using System.ComponentModel.DataAnnotations;

namespace AFBack.DTOs;


public class ReactionRequest
{
    [Required]
    public int MessageId { get; set; }

    [Required]
    [MinLength(1)]
    public string Emoji { get; set; } = string.Empty;
}