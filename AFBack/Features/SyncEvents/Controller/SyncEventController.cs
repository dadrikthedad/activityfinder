using AFBack.Common.Controllers;
using AFBack.Features.SyncEvents.DTOs;
using AFBack.Features.SyncEvents.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.SyncEvents.Controller;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SyncEventController(ISyncService syncService) : BaseController
{
    [HttpGet("sync")]
    [ProducesResponseType(typeof(SyncResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<SyncResponse>> GetSync()
    {
        var userId = User.GetUserId();
        var deviceId = User.GetDeviceId();

        var result = await syncService.ValidateSyncForDeviceAsync(userId, deviceId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);

    }
}
