namespace AFBack.Features.Settings.DTOs.Responses;

public class SettingsResponse
{
    // General
    public string Language { get; set; } = null!;

    // Profile visibility
    public bool PublicProfile { get; set; }
    public bool ShowAge { get; set; }
    public bool ShowBirthday { get; set; }
    public bool ShowGender { get; set; }
    public bool ShowEmail { get; set; }
    public bool ShowPhone { get; set; }
    public bool ShowRegion { get; set; }
    public bool ShowBio { get; set; }
    public bool ShowFriendsList { get; set; }
    public bool ShowStats { get; set; }
    public bool ShowWebsites { get; set; }
    public bool ShowPostalCode { get; set; }

    // Notifications
    public bool ReceiveEmailNotifications { get; set; }
    public bool ReceivePushNotifications { get; set; }
}
