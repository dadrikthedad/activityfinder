namespace AFBack.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class UserSettings
{   
    // primærnøkkeløn, som er UserId
    [Key, ForeignKey("User")]
    public int UserId { get; set; }

    public User User { get; set; } = null;

    public bool PublicProfile { get; set; } = true;
    public bool ShowGender { get; set; } = true;
    public bool ShowEmail { get; set; } = false;
    public bool ShowPhone { get; set; } = false;
    public bool ShowRegion { get; set; } = true;
    
    public bool ShowStats { get; set; } = true;
    
    public bool ShowWebsites { get; set; } = true;
    
    public bool ShowPostalCode { get; set; } = false;

    public string Language { get; set; } = "en";

    public bool RecieveEmailNotifications { get; set; } = true;
    public bool RecievePushNotifications { get; set; } = true;
    
    public bool IsSuspended { get; set; } = false;
    public string? SuspensionReason { get; set; }

}   