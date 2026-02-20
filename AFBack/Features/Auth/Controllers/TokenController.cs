using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Auth.Services;
using AFBack.Infrastructure.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Authorize]
public class TokenController(ITokenService tokenService) : BaseController
{   
    
    /// <summary>
    /// Roterer begge tokens for en bruker
    /// </summary>
    /// <param name="request">RefreshTokenRequest med token og devicefingerprint</param>
    /// <returns>TokenResponse</returns>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<TokenResponse>> RefreshTokens([FromBody] RefreshTokenRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        if (string.IsNullOrEmpty(ipAddress))
            return Problem(detail: "Unable to determine client IP address", 
                statusCode: StatusCodes.Status400BadRequest);
        
        var userAgent = Request.Headers.UserAgent.ToString();
        
        var result = await tokenService.RefreshAsync(request.RefreshToken, request.DeviceFingerprint,
            ipAddress, userAgent);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
