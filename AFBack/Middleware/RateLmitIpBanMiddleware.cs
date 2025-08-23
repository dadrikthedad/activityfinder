using AFBack.Services;
using AFBack.Utils;

namespace AFBack.Middleware;

public class RateLimitIpBanMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitIpBanMiddleware> _logger;

    public RateLimitIpBanMiddleware(RequestDelegate next, ILogger<RateLimitIpBanMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IpBanService ipBanService)
    {
        // Etter app.UseForwardedHeaders() er dette den ekte klient-IPen
        var clientIp = IpUtils.GetClientIp(context);
        var deviceId  = context.Request.Headers["X-Device-ID"].FirstOrDefault();

        if (await ipBanService.IsIpOrDeviceBannedAsync(clientIp, deviceId))
        {
            _logger.LogWarning("Blocked banned client (ip={IP}, device={DeviceId}) on {Path}",
                clientIp, deviceId ?? "n/a", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Access denied.");
            return;
        }

        await _next(context);
    }
}