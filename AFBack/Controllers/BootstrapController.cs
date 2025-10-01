using System.Security.Claims;
using AFBack.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AFBack.DTOs;
using AFBack.DTOs.BoostrapDTO;
using AFBack.DTOs.BoostrapDTO.Sync;
using AFBack.Features.Cache;
using AFBack.Infrastructure.Services;
using AFBack.Interface.Services;
using AFBack.Services;
using AFBack.Utils;
using Azure.Core;

namespace AFBack.Controllers
{
    [Route("api/me")]
    [Authorize]
    public class BootstrapController(
        ApplicationDbContext context,
        BootstrapService bootstrapService,
        UserOnlineService userOnlineService,
        ISyncService syncService,
        ILogger<BootstrapController> logger,
        UserCache userCache,
        ResponseService responseService)
        : BaseController<BootstrapController>(context, logger, userCache, responseService)
    {
        // ✅ Legg til i constructor


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

                var response = await bootstrapService.GetCriticalBootstrapAsync(userId.Value);
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

                var response = await bootstrapService.GetSecondaryBootstrapAsync(userId.Value);
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
                return Unauthorized(new { error = "Invalid user token" });

            // ✅ Prøv først header (mobile), fallback til generert device ID (web)
            var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();

            if (string.IsNullOrEmpty(deviceId))
            {
                // ✅ Generer konsistent device ID for web
                var userAgent = Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown";
                var clientIp = IpUtils.GetClientIp(HttpContext) ?? "unknown";
                
                // Lag en hash for å holde device ID konsistent per user/browser
                var deviceData = $"{userId}_{clientIp}_{userAgent}";
                var hash = deviceData.GetHashCode();
                deviceId = $"web_{Math.Abs(hash)}";
                
                _logger.LogInformation("Generated web device ID: {DeviceId} for user {UserId}", 
                    deviceId, userId.Value);
            }
            else
            {
                _logger.LogInformation("Using mobile device ID: {DeviceId} for user {UserId}", 
                    deviceId.Substring(0, 8) + "...", userId.Value);
            }

            // ✅ Send deviceId som separat parameter
            var (success, errorMessage) = await userOnlineService.MarkUserOnlineAsync(userId.Value, deviceId, request);

            if (success)
            {
                return Ok(new OnlineStatusResponse());
            }

            return StatusCode(500, new { 
                error = !string.IsNullOrEmpty(errorMessage) 
                    ? errorMessage 
                    : "Failed to update online status - unknown database error",
                userId = userId.Value,
                deviceId = deviceId.Substring(0, 8) + "..." // Log bare første 8 chars
            });
        }
        catch (Exception ex)
        {
            var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault() ?? "web_unknown";
            return StatusCode(500, new { 
                error = "Internal server error while marking user online", 
                details = ex.Message,
                userId = GetUserId(),
                deviceId = deviceId.Substring(0, Math.Min(8, deviceId.Length)) + "..."
            });
        }
    }

        [HttpPost("offline")]
        public async Task<IActionResult> MarkOffline()
        {
            var userId = GetUserId();
            
            try
            {
                if (userId == null)
                    return Unauthorized(new { error = "Invalid user token" });

                // ✅ Samme logic som MarkOnline
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();

                if (string.IsNullOrEmpty(deviceId))
                {
                    var userAgent = Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown";
                    var clientIp = IpUtils.GetClientIp(HttpContext) ?? "unknown";
                    var deviceData = $"{userId}_{clientIp}_{userAgent}";
                    var hash = deviceData.GetHashCode();
                    deviceId = $"web_{Math.Abs(hash)}";
                }

                var success = await userOnlineService.MarkUserOfflineAsync(userId.Value, deviceId);
        
                if (success)
                {
                    return Ok(new OnlineStatusResponse());
                }

                return StatusCode(500, new { 
                    error = "Failed to mark user as offline",
                    userId = userId.Value,
                    deviceId = deviceId.Substring(0, 8) + "..."
                });
            }
            catch (Exception ex)
            {
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault() ?? "web_unknown";
                return StatusCode(500, new { 
                    error = "Internal server error while marking user offline", 
                    details = ex.Message,
                    userId = GetUserId(),
                    deviceId = deviceId.Substring(0, Math.Min(8, deviceId.Length)) + "..."
                });
            }
        }

        [HttpPost("heartbeat")]
        public async Task<IActionResult> Heartbeat()
        {
            try
            {
                var userId = GetUserId();

                if (userId == null)
                {
                    return Unauthorized(new { error = "Invalid user token" });
                }

                // ✅ Samme logic som MarkOnline - header først, fallback til generert
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault();

                if (string.IsNullOrEmpty(deviceId))
                {
                    // ✅ Generer konsistent device ID for web (samme som MarkOnline)
                    var userAgent = Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown";
                    var clientIp = IpUtils.GetClientIp(HttpContext) ?? "unknown";
            
                    var deviceData = $"{userId}_{clientIp}_{userAgent}";
                    var hash = deviceData.GetHashCode();
                    deviceId = $"web_{Math.Abs(hash)}";
            
                    _logger.LogDebug("Generated web device ID for heartbeat: {DeviceId} for user {UserId}", 
                        deviceId, userId.Value);
                }
                else
                {
                    _logger.LogDebug("Using mobile device ID for heartbeat: {DeviceId} for user {UserId}", 
                        deviceId.Substring(0, 8) + "...", userId.Value);
                }

                await userOnlineService.UpdateHeartbeatAsync(userId.Value, deviceId);

                return Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
            }
            catch (Exception ex)
            {
                var deviceId = Request.Headers["X-Device-ID"].FirstOrDefault() ?? "web_unknown";
                return StatusCode(500, new { 
                    error = "Internal server error during heartbeat", 
                    details = ex.Message,
                    userId = GetUserId(),
                    deviceId = deviceId.Substring(0, Math.Min(8, deviceId.Length)) + "..."
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
        
                var response = await syncService.GetEventsSinceAsync(userId.Value, since);
        
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