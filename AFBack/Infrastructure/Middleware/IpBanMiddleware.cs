
using AFBack.Data;
using AFBack.DTOs.Security;
using AFBack.Infrastructure.Security.Models;
using AFBack.Infrastructure.Security.Utils;
using AFBack.Interface.Services;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Infrastructure.Middleware;

public class IpBanMiddleware(
    RequestDelegate next,
    ILogger<IpBanMiddleware> logger,
    IServiceScopeFactory scopeFactory)
{
    public async Task InvokeAsync(HttpContext context, IIpBanService ipBanService)
    {
        // Etter app.UseForwardedHeaders() er dette den ekte klient-IPen
        var clientIp = IpUtils.GetClientIp(context);
        var deviceId  = context.Request.Headers["X-Device-ID"].FirstOrDefault();

        if (await ipBanService.IsIpOrDeviceBannedAsync(clientIp, deviceId))
        {
            var banInfo = await GetBanInfoAsync(clientIp, deviceId);

            var response = new BanResponseDto
            {
                Message = "Your access has been temporarily restricted due to suspicious activity.",
                BannedUntil = banInfo?.ExpiresAt,
            };

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            
            logger.LogWarning("Blocked banned client (ip={IP}, device={DeviceId}) on {Path}",
                clientIp, deviceId ?? "n/a", context.Request.Path);
            
            await context.Response.WriteAsJsonAsync(response);
            return;
        }

        await next(context);
    }

    private async Task<BanInfo?> GetBanInfoAsync(string? ipAddress, string? deviceId)
    {
        using var scope = scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!string.IsNullOrEmpty(deviceId))
        {
            var deviceBan = await context.BanInfos
                .Where(b => b.DeviceId == deviceId && b.IsActive)
                .FirstOrDefaultAsync();

            if (deviceBan != null)
                return deviceBan;
        }

        if (!string.IsNullOrEmpty(ipAddress))
        {
            return await context.BanInfos
                .Where(b => b.IpAddress == ipAddress && b.IsActive && string.IsNullOrEmpty(b.DeviceId))
                .FirstOrDefaultAsync();
        }

        return null;
    }
}
