namespace AFBack.Features.Bootstrap.DTOs.Responses;

public class UserSettingsResponse
{
    // General
    public required string Language { get; init; }
    
    // Profile visibility
    public bool PublicProfile { get; init; }
    public bool ShowAge { get; init; }
    public bool ShowBirthday { get; init; }
    public bool ShowGender { get; init; }
    public bool ShowEmail { get; init; }
    public bool ShowPhone { get; init; }
    public bool ShowRegion { get; init; }
    public bool ShowBio { get; init; }
    public bool ShowStats { get; init; }
    public bool ShowWebsites { get; init; }
    public bool ShowPostalCode { get; init; }
    
    // Notifications
    public bool ReceiveEmailNotifications { get; init; }
    public bool ReceivePushNotifications { get; init; }
}
