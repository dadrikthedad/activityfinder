using AFBack.Features.Auth.Models;

namespace AFBack.Tests.Builders;

public class LoginHistoryBuilder
{
    private string    _userId    = string.Empty;
    private int       _deviceId  = 0;
    private DateTime  _loginAt   = DateTime.UtcNow;
    private DateTime? _logoutAt  = null;
    private string    _ipAddress = "127.0.0.1";

    public LoginHistoryBuilder ForUser(string userId)         { _userId = userId;       return this; }
    public LoginHistoryBuilder ForDevice(int deviceId)        { _deviceId = deviceId;   return this; }
    public LoginHistoryBuilder LoginAt(DateTime loginAt)      { _loginAt = loginAt;     return this; }
    public LoginHistoryBuilder AsLoggedOut()                  { _logoutAt = DateTime.UtcNow; return this; }

    public LoginHistory Build() => new()
    {
        UserId       = _userId,
        UserDeviceId = _deviceId,
        LoginAt      = _loginAt,
        LogoutAt     = _logoutAt,
        IpAddress    = _ipAddress,
    };
}
