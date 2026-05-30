using AFBack.Features.Profile.Models;

namespace AFBack.Tests.Builders;

public class UserProfileBuilder
{
    private string  _userId      = string.Empty;
    private string  _countryCode = "NO";
    private DateOnly _dateOfBirth = new DateOnly(1995, 6, 15);
    private string? _bio;

    public UserProfileBuilder ForUser(string userId)           { _userId = userId;       return this; }
    public UserProfileBuilder WithCountryCode(string code)     { _countryCode = code;   return this; }
    public UserProfileBuilder WithDateOfBirth(DateOnly dob)    { _dateOfBirth = dob;    return this; }
    public UserProfileBuilder WithBio(string bio)              { _bio = bio;             return this; }

    public UserProfile Build() => new()
    {
        UserId      = _userId,
        CountryCode = _countryCode,
        DateOfBirth = _dateOfBirth,
        Bio         = _bio,
    };
}
