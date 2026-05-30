using AFBack.Features.Settings.Models;

namespace AFBack.Tests.Builders;

public class UserSettingsBuilder
{
    private string _userId   = string.Empty;
    private string _language = "no";

    // Speiler modellens standardverdier
    private bool _publicProfile              = true;
    private bool _showAge                    = true;
    private bool _showBirthday               = false;
    private bool _showGender                 = true;
    private bool _showEmail                  = false;
    private bool _showPhone                  = false;
    private bool _showRegion                 = true;
    private bool _showBio                    = true;
    private bool _showStats                  = true;
    private bool _showWebsites               = true;
    private bool _showPostalCode             = false;
    private bool _receiveEmailNotifications  = true;
    private bool _receivePushNotifications   = true;

    public UserSettingsBuilder ForUser(string userId)          { _userId = userId;                        return this; }
    public UserSettingsBuilder WithLanguage(string lang)       { _language = lang;                        return this; }
    public UserSettingsBuilder AsPrivate()                     { _publicProfile = false;                  return this; }
    public UserSettingsBuilder WithoutEmailNotifications()     { _receiveEmailNotifications = false;      return this; }
    public UserSettingsBuilder WithoutPushNotifications()      { _receivePushNotifications = false;       return this; }

    public UserSettings Build() => new()
    {
        UserId                    = _userId,
        Language                  = _language,
        PublicProfile             = _publicProfile,
        ShowAge                   = _showAge,
        ShowBirthday              = _showBirthday,
        ShowGender                = _showGender,
        ShowEmail                 = _showEmail,
        ShowPhone                 = _showPhone,
        ShowRegion                = _showRegion,
        ShowBio                   = _showBio,
        ShowStats                 = _showStats,
        ShowWebsites              = _showWebsites,
        ShowPostalCode            = _showPostalCode,
        ReceiveEmailNotifications = _receiveEmailNotifications,
        ReceivePushNotifications  = _receivePushNotifications,
    };
}
