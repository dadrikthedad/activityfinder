namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class UserSettings
{   
    // primærnøkkeløn, som er UserId
    [Key, ForeignKey("User")]
    public int UserId { get; set; }

    public User User { get; set; } = null;

    public bool ShowEmail { get; set; } = false;
    public bool ShowPhone { get; set; } = false;
    public bool ShowProfileImage { get; set; } = true;

    public string Language { get; set; } = "en";
    
    public DateTime? LastSeen { get; set; }
    
    public bool IsSuspended { get; set; } = false;
    public string? SuspensionReason { get; set; }

}   