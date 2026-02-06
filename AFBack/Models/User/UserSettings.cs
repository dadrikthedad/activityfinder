using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AFBack.Features.Auth.Models;

namespace AFBack.Models.User;

public class UserSettings
{   
    // ======================== PRIMÆRNØKKEL ========================
    [Key, ForeignKey("AppUser")]
    [MaxLength(100)]
    public string UserId { get; set; } = null!;
    
    // ======================== General settings ========================
    [MaxLength(100)]
    public string Language { get; set; } = "en";

    // ======================== Profile settings ========================
    public bool PublicProfile { get; set; } = true;
    public bool ShowAge { get; set; } = true;
    public bool ShowBirthday { get; set; }
    public bool ShowGender { get; set; } = true;
    public bool ShowEmail { get; set; }
    public bool ShowPhone { get; set; } 
    public bool ShowRegion { get; set; } = true;
    public bool ShowStats { get; set; } = true;
    public bool ShowWebsites { get; set; } = true;
    public bool ShowPostalCode { get; set; }
    
    // ======================== Notifications settings ========================
    public bool ReceiveEmailNotifications { get; set; } = true;
    public bool ReceivePushNotifications { get; set; } = true;
    
    // ======================== Navigasjonsegenskaper ========================
    public AppUser AppUser { get; set; } = null!;

}   
