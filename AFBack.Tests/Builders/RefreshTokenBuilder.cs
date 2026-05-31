using AFBack.Features.Auth.Models;

namespace AFBack.Tests.Builders;

public class RefreshTokenBuilder
{
    private string    _userId       = string.Empty;
    private int       _deviceId     = 0;
    private string    _token        = Guid.NewGuid().ToString();
    private DateTime  _expiresAt    = DateTime.UtcNow.AddDays(365);
    private bool      _isRevoked    = false;
    private DateTime? _revokedAt    = null;
    private string?   _revokedReason = null;

    public RefreshTokenBuilder ForUser(string userId)              { _userId = userId;           return this; }
    public RefreshTokenBuilder ForDevice(int deviceId)             { _deviceId = deviceId;       return this; }
    public RefreshTokenBuilder WithToken(string token)             { _token = token;             return this; }
    public RefreshTokenBuilder ExpiresAt(DateTime expiresAt)       { _expiresAt = expiresAt;     return this; }
    public RefreshTokenBuilder AsExpired()                         { _expiresAt = DateTime.UtcNow.AddDays(-1); return this; }
    public RefreshTokenBuilder AsRevoked(string reason = "Test")
    {
        _isRevoked     = true;
        _revokedAt     = DateTime.UtcNow;
        _revokedReason = reason;
        return this;
    }
    public RefreshTokenBuilder RevokedAt(DateTime revokedAt)       { _revokedAt = revokedAt;     return this; }

    public RefreshToken Build() => new()
    {
        UserId        = _userId,
        UserDeviceId  = _deviceId,
        Token         = _token,
        ExpiresAt     = _expiresAt,
        IsRevoked     = _isRevoked,
        RevokedAt     = _revokedAt,
        RevokedReason = _revokedReason,
        IpAddress     = "127.0.0.1",
    };
}
