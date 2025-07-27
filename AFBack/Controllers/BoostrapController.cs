using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.Services;

namespace AFBack.Controllers
{
    [Route("api/me")]
    [Authorize]
    public class BootstrapController : BaseController
    {
        private readonly BootstrapService _bootstrapService;
        private readonly UserOnlineService _userOnlineService;
        

        public BootstrapController(BootstrapService bootstrapService, UserOnlineService userOnlineSerivce)
        {
            _bootstrapService = bootstrapService;
            _userOnlineService = userOnlineSerivce;

        }

        [HttpGet("bootstrap/critical")]
        public async Task<ActionResult<CriticalBootstrapResponseDTO>> GetCriticalBootstrap()
        {
            try
            {
                var userId = GetUserId();
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }

                var response = await _bootstrapService.GetCriticalBootstrapAsync(userId.Value);
                return Ok(response);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                // 👈 ENDRE DENNE - vis faktisk feil
                return StatusCode(500, new { 
                    error = ex.Message, 
                    stackTrace = ex.StackTrace?.Split('\n').Take(5) // First 5 lines
                });
            }
        }

        [HttpGet("bootstrap/secondary")]
        public async Task<ActionResult<SecondaryBootstrapResponseDTO>> GetSecondaryBootstrap()
        {
            try
            {
                var userId = GetUserId();
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }

                var response = await _bootstrapService.GetSecondaryBootstrapAsync(userId.Value);
                return Ok(response);
            }
            catch (Exception ex)
            {
                // 👈 ENDRE DENNE - vis faktisk feil
                return StatusCode(500, new { 
                    error = ex.Message, 
                    stackTrace = ex.StackTrace?.Split('\n').Take(5) // First 5 lines
                });
            }
        }
        
        [HttpPost("online")]
        public async Task<IActionResult> MarkOnline([FromBody] OnlineStatusRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }

                // 🔧 FORBEDRING: Validér request
                if (string.IsNullOrEmpty(request.DeviceId) || string.IsNullOrEmpty(request.Platform))
                {
                    return BadRequest(new { error = "DeviceId and Platform are required" });
                }

                var (success, errorMessage) = await _userOnlineService.MarkUserOnlineAsync(userId.Value, request);
        
                if (success)
                {
                    return Ok(new OnlineStatusResponse());
                }

                // 🔧 ENDRING: Bruk spesifikk feilmelding fra service
                return StatusCode(500, new { 
                    error = !string.IsNullOrEmpty(errorMessage) 
                        ? errorMessage 
                        : "Failed to update online status - unknown database error",
                    userId = userId.Value,
                    deviceId = request.DeviceId 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = "Internal server error while marking user online", 
                    details = ex.Message,
                    userId = GetUserId(),
                    deviceId = request?.DeviceId
                });
            }
        }

        [HttpPost("offline")]
        public async Task<IActionResult> MarkOffline([FromBody] OfflineStatusRequest request)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }

                // 🔧 FORBEDRING: Validér request
                if (string.IsNullOrEmpty(request.DeviceId))
                {
                    return BadRequest(new { error = "DeviceId is required" });
                }

                var success = await _userOnlineService.MarkUserOfflineAsync(userId.Value, request.DeviceId);
                
                if (success)
                {
                    return Ok(new OnlineStatusResponse());
                }

                return StatusCode(500, new { error = "Failed to mark user as offline" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = "Internal server error", 
                    details = ex.Message 
                });
            }
        }

        [HttpPost("heartbeat")]
        public async Task<IActionResult> Heartbeat()
        {
            try
            {
                var userId = GetUserId();
                
                // 🔧 FORBEDRING: Hent deviceId fra request body eller header
                var deviceId = Request.Headers["X-Device-Id"].FirstOrDefault();
                
                
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }
                
                if (string.IsNullOrEmpty(deviceId))
                {
                    return BadRequest(new { error = "Device ID is required in X-Device-Id header" });
                }

                await _userOnlineService.UpdateHeartbeatAsync(userId.Value, deviceId);
                
                return Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = "Internal server error", 
                    details = ex.Message 
                });
            }
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : null;
        }
    }
}