using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Models;


namespace AFBack.Models;

public class Reaction
{
    [Key]
    public int Id { get; set; }

    public int MessageId { get; set; }
    
    public string UserId { get; set; } = string.Empty;

    public string Emoji { get; set; } = string.Empty;

    [ForeignKey("MessageId")]
    public Message Message { get; set; } = null!;
}