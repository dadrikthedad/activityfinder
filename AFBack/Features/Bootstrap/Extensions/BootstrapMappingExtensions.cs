using AFBack.Features.Auth.Models;
using AFBack.Features.Bootstrap.DTOs.Responses;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;

namespace AFBack.Features.Bootstrap.Extensions;

public static class BootstrapMappingExtensions
{
    public static UserResponse ToUserResponse(this AppUser user) => new()
    {
        Id = user.Id,
        FirstName = user.FirstName,
        LastName = user.LastName,
        FullName = user.FullName,
        ProfileImageUrl = user.ProfileImageUrl,
        Email = user.Email,
        PhoneNumber = user.PhoneNumber,
        CreatedAt = user.CreatedAt,
        OnBoardingCompletedAt = user.OnBoardingCompletedAt
    };

    public static UserSettingsResponse ToSettingsResponse(this UserSettings settings) => new()
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
        ShowFriendsList = settings.ShowFriendsList,
        ShowStats = settings.ShowStats,
        ShowWebsites = settings.ShowWebsites,
        ShowPostalCode = settings.ShowPostalCode,
        ReceiveEmailNotifications = settings.ReceiveEmailNotifications,
        ReceivePushNotifications = settings.ReceivePushNotifications
    };

    public static UserProfileResponse ToProfileResponse(this UserProfile profile) => new()
    {
        CountryCode = profile.CountryCode,
        Region = profile.Region,
        City = profile.City,
        PostalCode = profile.PostalCode,
        DateOfBirth = profile.DateOfBirth,
        Gender = profile.Gender,
        Age = profile.Age,
        Bio = profile.Bio,
        Websites = profile.Websites,
        ContactEmail = profile.ContactEmail,
        ContactPhone = profile.ContactPhone
    };
}
