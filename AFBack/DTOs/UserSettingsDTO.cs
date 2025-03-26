namespace AFBack.DTOs;

public class UserSettingsDTO
{
    public bool PublicProfile { get; set; }
    public bool ShowGender { get; set; }
    public bool ShowEmail { get; set; }
    public bool ShowPhone { get; set; }
    public bool ShowRegion { get; set; }

    public string Language { get; set; } = "en";

    public bool RecieveEmailNotifications { get; set; }
    public bool RecievePushNotifications { get; set; }
}