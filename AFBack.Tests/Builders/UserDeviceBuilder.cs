using AFBack.Features.Auth.Enums;
using AFBack.Features.Auth.Models;

namespace AFBack.Tests.Builders;

public class UserDeviceBuilder
{
    private string            _userId      = string.Empty;
    private string            _deviceName  = "Test Device";
    private string            _fingerprint = Guid.NewGuid().ToString();
    private DeviceType        _deviceType  = DeviceType.Mobile;
    private OperatingSystemType _os        = OperatingSystemType.Android;
    private bool              _isTrusted   = false;
    private string?           _ipAddress   = "127.0.0.1";

    public UserDeviceBuilder ForUser(string userId)             { _userId = userId;           return this; }
    public UserDeviceBuilder WithDeviceName(string name)        { _deviceName = name;         return this; }
    public UserDeviceBuilder WithFingerprint(string fp)         { _fingerprint = fp;          return this; }
    public UserDeviceBuilder WithDeviceType(DeviceType type)    { _deviceType = type;         return this; }
    public UserDeviceBuilder WithOs(OperatingSystemType os)     { _os = os;                   return this; }
    public UserDeviceBuilder WithIpAddress(string ip)           { _ipAddress = ip;            return this; }
    public UserDeviceBuilder AsTrusted()                        { _isTrusted = true;          return this; }

    public UserDevice Build() => new()
    {
        UserId            = _userId,
        DeviceName        = _deviceName,
        DeviceFingerprint = _fingerprint,
        DeviceType        = _deviceType,
        OperatingSystem   = _os,
        IsTrusted         = _isTrusted,
        LastIpAddress     = _ipAddress,
        FirstSeenAt       = DateTime.UtcNow,
        LastUsedAt        = DateTime.UtcNow,
    };
}
