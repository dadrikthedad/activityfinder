using AFBack.Features.Auth.Models;
using AFBack.Features.Profile.Models;
using AFBack.Features.Settings.Models;

namespace AFBack.Tests.Builders;

public class UserBuilder
{
    private string _id                   = Guid.NewGuid().ToString();
    private string _email                = $"test-{Guid.NewGuid():N}@test.no";
    private string _firstName            = "Test";
    private string _lastName             = "Bruker";
    private string _phoneNumber          = $"+47{Random.Shared.Next(10_000_000, 99_999_999)}";
    private bool   _emailConfirmed       = true;
    private bool   _phoneConfirmed       = true;
    private string? _passwordHash;
    private UserProfile?  _profile;
    private UserSettings? _settings;
    private DateTime _createdAt = DateTime.UtcNow;

    public UserBuilder WithId(string id)                     { _id = id;                   return this; }
    public UserBuilder WithEmail(string email)               { _email = email;             return this; }
    public UserBuilder WithFirstName(string name)            { _firstName = name;          return this; }
    public UserBuilder WithLastName(string name)             { _lastName = name;           return this; }
    public UserBuilder WithPhoneNumber(string phone)         { _phoneNumber = phone;       return this; }
    public UserBuilder WithPasswordHash(string hash)         { _passwordHash = hash;       return this; }
    public UserBuilder WithProfile(UserProfile profile)      { _profile = profile;         return this; }
    public UserBuilder WithSettings(UserSettings settings)   { _settings = settings;       return this; }
    public UserBuilder WithCreatedAt(DateTime createdAt)     { _createdAt = createdAt;     return this; }

    // Brukeren er fullstendig verifisert (standard — de fleste tester trenger dette)
    public UserBuilder AsVerified()
    {
        _emailConfirmed = true;
        _phoneConfirmed = true;
        return this;
    }

    // Brukeren har ikke fullfort verifisering
    public UserBuilder AsUnverified()
    {
        _emailConfirmed = false;
        _phoneConfirmed = false;
        return this;
    }

    public UserBuilder AsEmailUnverified()
    {
        _emailConfirmed = false;
        return this;
    }

    public UserBuilder AsPhoneUnverified()
    {
        _phoneConfirmed = false;
        return this;
    }

    public AppUser Build() => new()
    {
        Id                   = _id,
        UserName             = _email,
        Email                = _email,
        NormalizedEmail      = _email.ToUpperInvariant(),
        NormalizedUserName   = _email.ToUpperInvariant(),
        FirstName            = _firstName,
        LastName             = _lastName,
        FullName             = $"{_firstName} {_lastName}",
        PhoneNumber          = _phoneNumber,
        EmailConfirmed       = _emailConfirmed,
        PhoneNumberConfirmed = _phoneConfirmed,
        PasswordHash         = _passwordHash,
        SecurityStamp        = Guid.NewGuid().ToString(),
        ConcurrencyStamp     = Guid.NewGuid().ToString(),
        CreatedAt            = _createdAt,
        UserProfile          = _profile,
        UserSettings         = _settings,
    };
}
