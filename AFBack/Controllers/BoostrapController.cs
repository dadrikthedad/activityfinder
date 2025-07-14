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

        public BootstrapController(BootstrapService bootstrapService)
        {
            _bootstrapService = bootstrapService;
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
                return StatusCode(500, new { error = "Failed to load secondary data" });
            }
        }
    }
}