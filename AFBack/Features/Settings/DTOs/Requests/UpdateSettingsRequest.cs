using System.ComponentModel.DataAnnotations;

namespace AFBack.Features.Settings.DTOs.Requests;

public class UpdateSettingsRequest
{
    [Required(ErrorMessage = "Language is required")]
    [MaxLength(100, ErrorMessage = "Language cannot exceed 100 characters")]
    public string Language { get; init; } = null!;

    public bool PublicProfile { get; init; }
    public bool ShowAge { get; init; }
    public bool ShowBirthday { get; init; }
    public bool ShowGender { get; init; }
    public bool ShowEmail { get; init; }
    public bool ShowPhone { get; init; }
    public bool ShowRegion { get; init; }
    public bool ShowBio { get; init; }
    public bool ShowFriendsList { get; init; }
    public bool ShowStats { get; init; }
    public bool ShowWebsites { get; init; }
    public bool ShowPostalCode { get; init; }
    public bool ReceiveEmailNotifications { get; init; }
    public bool ReceivePushNotifications { get; init; }
}
