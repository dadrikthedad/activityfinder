using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;
using AFBack.Features.Messaging.Models;


namespace AFBack.Models;

public class Reaction
{
    [Key]
    public int Id { get; set; }

    public int MessageId { get; set; }
    
    public int UserId { get; set; }

    public string Emoji { get; set; } = string.Empty;

    [ForeignKey("MessageId")]
    public Message Message { get; set; } = null!;
    
    [ForeignKey("UserId")]
    public AppUser User { get; set; } = null!;
}
