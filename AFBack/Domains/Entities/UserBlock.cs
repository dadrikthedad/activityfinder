using AFBack.Models;

namespace AFBack.Domains.Entities;

public class UserBlock
{
    public int Id { get; set; }
    
    // Brukeren som blokkerer
    public int BlockerId { get; set; }
    public User Blocker { get; set; } = null!;
    
    // Brukeren som blir blokkert
    public int BlockedUserId { get; set; }
    public User BlockedUser { get; set; } = null!;
    
    // Når blokkeringen skjedde
    public DateTime BlockedAt { get; set; } = DateTime.UtcNow;
    
}