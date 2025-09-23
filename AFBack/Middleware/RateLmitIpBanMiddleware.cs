using System.Text.Json;
using AFBack.Data;
using AFBack.DTOs.Security;
using AFBack.Models;
using AFBack.Services;
using AFBack.Utils;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Middleware;

public class RateLimitIpBanMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitIpBanMiddleware> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public RateLimitIpBanMiddleware(RequestDelegate next, ILogger<RateLimitIpBanMiddleware> logger, IServiceScopeFactory scopeFactory)
    {
        _next = next;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public async Task InvokeAsync(HttpContext context, IpBanService ipBanService)
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

            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.ContentType = "application/json";
            
            _logger.LogWarning("Blocked banned client (ip={IP}, device={DeviceId}) on {Path}",
                clientIp, deviceId ?? "n/a", context.Request.Path);
            
            await context.Response.WriteAsJsonAsync(response);
            return;
        }

        await _next(context);
    }

    private async Task<BanInfo?> GetBanInfoAsync(string? ipAddress, string? deviceId)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

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