using AFBack.Common.Controllers;
using AFBack.Features.Auth.DTOs.Request;
using AFBack.Features.Auth.DTOs.Response;
using AFBack.Features.Dev.DTOs;
using AFBack.Features.Dev.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Dev.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevController(IDevService devService) : BaseController
{
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> DevLogin([FromBody] VerifyMfaRequest request, 
        CancellationToken ct = default)
    {
        var ipAddress = GetIpAddress();
    
        var result = await devService.DevLoginAsync(request, ipAddress, null, ct);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    [HttpGet("users")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<DevUserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<DevUserDto>>> GetUsers(CancellationToken ct = default)
    {
        var result = await devService.GetUsersAsync();
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
}
