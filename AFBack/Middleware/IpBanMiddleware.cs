using AFBack.Services;
using AFBack.Utils;

namespace AFBack.Middleware;

public class IpBanMiddleware
{
    public async Task InvokeAsync(HttpContext context, RequestDelegate next, IpBanService ipBanService)
    {
        var clientIp = IpUtils.GetClientIp(context);
        var deviceId = IpUtils.IsMobileAppRequest(context) 
            ? context.Request.Headers["X-Device-ID"].FirstOrDefault() 
            : null;

        // OPPDATERT: Bruk ny metode som sjekker både IP og device
        if (await ipBanService.IsIpOrDeviceBannedAsync(clientIp, deviceId))
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsync("Access denied.");
            return;
        }

        await next(context);
    }
}