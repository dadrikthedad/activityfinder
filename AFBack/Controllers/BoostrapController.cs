using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.DTOs.BoostrapDTO.Sync;
using AFBack.Services;
using Azure.Core;

namespace AFBack.Controllers
{
    [Route("api/me")]
    [Authorize]
    public class BootstrapController : BaseController
    {
        private readonly BootstrapService _bootstrapService;
        private readonly UserOnlineService _userOnlineService;
        private readonly SyncService _syncService;
        

        public BootstrapController(BootstrapService bootstrapService, UserOnlineService userOnlineService, SyncService syncService)
        {
            _bootstrapService = bootstrapService;
            _userOnlineService = userOnlineService;
            _syncService = syncService; 
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
            try // ✅ Legg til try-catch tilbake
            {
                var userId = GetUserId();
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault(); // Fra header

                if (userId == null)
                    return Unauthorized(new { error = "Invalid user token" });

                if (string.IsNullOrEmpty(deviceId))
                    return BadRequest(new { error = "Device ID is required in X-Device-ID header" });

                // ✅ Send deviceId som separat parameter
                var (success, errorMessage) = await _userOnlineService.MarkUserOnlineAsync(userId.Value, deviceId, request);

                if (success)
                {
                    return Ok(new OnlineStatusResponse());
                }

                return StatusCode(500, new { 
                    error = !string.IsNullOrEmpty(errorMessage) 
                        ? errorMessage 
                        : "Failed to update online status - unknown database error",
                    userId = userId.Value,
                    deviceId = deviceId // ✅ Bruk deviceId fra header, ikke request
                });
            }
            catch (Exception ex)
            {
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();
                return StatusCode(500, new { 
                    error = "Internal server error while marking user online", 
                    details = ex.Message,
                    userId = GetUserId(),
                    deviceId = deviceId // ✅ Bruk deviceId fra header, ikke request
                });
            }
        }

        [HttpPost("offline")]
        public async Task<IActionResult> MarkOffline()
        {
            try // ✅ Legg til try-catch
            {
                var userId = GetUserId();
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault(); // Fra header

                if (userId == null)
                    return Unauthorized(new { error = "Invalid user token" });

                if (string.IsNullOrEmpty(deviceId))
                    return BadRequest(new { error = "Device ID is required in X-Device-ID header" });

                var success = await _userOnlineService.MarkUserOfflineAsync(userId.Value, deviceId);
        
                if (success)
                {
                    return Ok(new OnlineStatusResponse());
                }

                return StatusCode(500, new { 
                    error = "Failed to mark user as offline",
                    userId = userId.Value, // ✅ Legg til for debugging
                    deviceId = deviceId    // ✅ Legg til for debugging
                });
            }
            catch (Exception ex)
            {
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault(); // ✅ Hent deviceId for error logging
                return StatusCode(500, new { 
                    error = "Internal server error while marking user offline", 
                    details = ex.Message,
                    userId = GetUserId(),
                    deviceId = deviceId // ✅ Inkluder deviceId i error response
                });
            }
        }

        [HttpPost("heartbeat")]
        public async Task<IActionResult> Heartbeat()
        {
            try
            {
                var userId = GetUserId();
        
                // ✅ Bruk samme header-navn som deviceInfoService sender
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault(); // Endre til X-Device-ID
        
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }
        
                if (string.IsNullOrEmpty(deviceId))
                {
                    return BadRequest(new { error = "Device ID is required in X-Device-ID header" }); // Oppdater feilmelding
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
        
        [HttpGet("sync")]
        public async Task<ActionResult<SyncResponseDTO>> GetSync([FromQuery] string? since)
        {
            try
            {
                var userId = GetUserId();
                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }
        
                var response = await _syncService.GetEventsSinceAsync(userId.Value, since);
        
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = "Failed to process sync request", 
                    details = ex.Message,
                    userId = GetUserId()
                });
            }
        }
    }
}