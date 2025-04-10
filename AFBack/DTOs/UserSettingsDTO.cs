namespace AFBack.DTOs;

public class UserSettingsDTO
{
    public string Language { get; set; } = "en";
    public bool PublicProfile { get; set; }
    public bool ShowGender { get; set; }
    public bool ShowEmail { get; set; }
    public bool ShowPhone { get; set; }
    public bool ShowRegion { get; set; }
    public bool ShowPostalCode { get; set; }
    public bool ShowStats { get; set; }
    public bool ShowWebsites { get; set; }
    public bool RecieveEmailNotifications { get; set; }
    public bool RecievePushNotifications { get; set; }
}