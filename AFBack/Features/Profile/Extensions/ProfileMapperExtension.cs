using AFBack.Features.Profile.DTOs.Responses;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;

namespace AFBack.Features.Profile.Extensions;

public static class ProfileMapperExtension
{
    public static MyProfileResponse ToMyProfileResponse(this UserProfile profile) => new()
    {
            CountryCode = profile.CountryCode,
            DateOfBirth = profile.DateOfBirth,
            Age = profile.Age,
            Bio = profile.Bio,
            Websites = profile.Websites,
            ContactEmail = profile.ContactEmail,
            ContactPhone = profile.ContactPhone,
            UpdatedAt = profile.UpdatedAt
        };


    public static PublicProfileResponse ToPublicResponse(this UserProfile profile, UserSettings settings)
        => new()
    {
        Id = profile.UserId,
        FullName = profile.AppUser!.FullName,
        ProfileImageUrl = profile.AppUser!.ProfileImageUrl,
        CountryCode = profile.CountryCode,
        Age = settings.ShowAge ? profile.Age : null,
        DateOfBirth = settings.ShowBirthday ? profile.DateOfBirth : null,
        Bio = settings.ShowGender ? profile.Bio : null,
        Websites = settings.ShowWebsites ? profile.Websites : null,
        ContactEmail = settings.ShowEmail  ? profile.ContactEmail : null,
        ContactPhone = settings.ShowPhone  ? profile.ContactPhone : null
    };
}
