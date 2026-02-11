using AFBack.Infrastructure.Security.Services;
using AFBack.Infrastructure.Security.Utils;


namespace AFBack.Infrastructure.Middleware;

public class IpBanMiddleware(
    RequestDelegate next,
    ILogger<IpBanMiddleware> logger)
{
    /// <summary>
    /// Utfører en sjekk på hver http forespørsel for å sjekke om brukeren er bannet
    /// </summary>
    /// <param name="context">Http-forespørselen</param>
    /// <param name="ipBanService">IpBanService vi utfører operasjoner på</param>
    public async Task InvokeAsync(HttpContext context, IIpBanService ipBanService)
    {
        // Henter brukerens IP
        var clientIp = IpUtils.GetClientIp(context);
        
        // Sjekker om brukeren er banned eller ikke
        if (await ipBanService.IsIpBannedAsync(clientIp))
        {
            logger.LogWarning("Blocked banned IP {IP} on {Path}",
                clientIp, context.Request.Path);
                
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Your access has been restricted due to suspicious activity."
            });
            return;
        }

        await next(context);
    }
}
