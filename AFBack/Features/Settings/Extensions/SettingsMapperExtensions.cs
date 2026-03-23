using AFBack.Features.Settings.DTOs.Responses;
using AFBack.Features.Settings.Models;

namespace AFBack.Features.Settings.Extensions;

public static class SettingsMapperExtension
{
    public static SettingsResponse ToResponse(this UserSettings settings) => new()
    {
        Language = settings.Language,
        PublicProfile = settings.PublicProfile,
        ShowAge = settings.ShowAge,
        ShowBirthday = settings.ShowBirthday,
        ShowGender = settings.ShowGender,
        ShowEmail = settings.ShowEmail,
        ShowPhone = settings.ShowPhone,
        ShowRegion = settings.ShowRegion,
        ShowBio = settings.ShowBio,
        ShowStats = settings.ShowStats,
        ShowWebsites = settings.ShowWebsites,
        ShowPostalCode = settings.ShowPostalCode,
        ReceiveEmailNotifications = settings.ReceiveEmailNotifications,
        ReceivePushNotifications = settings.ReceivePushNotifications
    };
}
