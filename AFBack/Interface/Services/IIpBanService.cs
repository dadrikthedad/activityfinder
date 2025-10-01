using AFBack.Constants;
using AFBack.Data;

namespace AFBack.Interface.Services;

public interface IIpBanService
{
    Task<bool> IsIpOrDeviceBannedAsync(string? ipAddress, string? deviceId = null);

    Task<bool> IsDeviceBannedAsync(string deviceId);

    Task<bool> IsIpBannedInternalAsync(string normalizedIp);

    Task ReportSuspiciousActivityAsync(string? ipAddress, string activityType, string reason,
        string? userAgent = null, string? endpoint = null, string? deviceId = null);

    Task HandleSuspiciousActivityEscalationAsync(ApplicationDbContext context, string ipAddress,
        string? deviceId, string activityType, bool isFromSharedNetwork);

    Task BanDeviceAsync(string deviceId, BanType banType, string reason, string bannedBy = "System");

    Task<int> GetRecentSuspiciousCountAsync(ApplicationDbContext context, string? ipAddress, string? deviceId);

    bool IsWhitelisted(string ipAddress);

    void ClearExpiredFromCache();

}
