using AFBack.Features.Profile.DTOs.Responses;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;

namespace AFBack.Features.Profile.Extensions;

public static class ProfileMapperExtension
{
    public static MyProfileResponse ToMyProfileResponse(this UserProfile profile) => new()
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
        Region = settings?.ShowRegion == true ? profile.Region : null,
        City = settings?.ShowRegion == true ? profile.City : null,
        PostalCode = settings?.ShowPostalCode == true ? profile.PostalCode : null,
        Age = settings?.ShowAge == true ? profile.Age : null,
        DateOfBirth = settings?.ShowBirthday == true ? profile.DateOfBirth : null,
        Gender = settings?.ShowGender == true ? profile.Gender : null,
        Bio = settings?.ShowGender == true ? profile.Bio : null,
        Websites = settings?.ShowWebsites == true ? profile.Websites : null,
        ContactEmail = settings?.ShowEmail == true ? profile.ContactEmail : null,
        ContactPhone = settings?.ShowPhone == true ? profile.ContactPhone : null
    };
}
