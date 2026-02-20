using System.IdentityModel.Tokens.Jwt;
using AFBack.Features.Auth.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Infrastructure.Middleware;

/// <summary>
/// Middleware som sjekker om et access token er blacklistet i Redis.
/// Kjører etter standard JWT-autentisering, men før authorization.
/// Kun aktiv for autentiserte requests (anonyme endepunkter skippes).
/// Returner ProblemDetails slik som resten av API-et
/// </summary>
/// <param name="next"></param>
public class TokenBlacklistMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITokenService tokenService)
    {
        // Skip hvis bruker ikke er autentisert (anonyme endepunkter)
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }
        
        // Hent JWT-ID, JTI, fra token claims
        var jti = context.User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        
        // Sjekker at det er en JTI og om token er Blacklisted i Redis
        if (!string.IsNullOrEmpty(jti) && await tokenService.IsAccessTokenBlacklistedAsync(jti))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Title = "Token has been revoked",
                Status = StatusCodes.Status401Unauthorized,
                Detail = "Your session has been invalidated. Please log in again."
            });
            return;
        }
        
        await next(context);
    }
}
