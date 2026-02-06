using System.Security.Claims;
using AFBack.Data;
using AFBack.DTOs.Auth;
using AFBack.DTOs.Crypto;
using AFBack.Extensions;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Infrastructure.Services;
using AFBack.Services.Crypto;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require authentication for all E2EE endpoints
    public class E2EEController(
        AppDbContext context,
        E2EEService e2EeService,
        ILogger<E2EEController> logger,
        SecretClient secretClient,
        IUserCache userCache,
        ResponseService responseService)
        : BaseController<E2EEController>(context, logger, userCache, responseService)
    {
        /// <summary>
        /// Store or update appUser's public key for E2EE
        /// </summary>
        [HttpPost("public-key")]
        public async Task<IActionResult> StorePublicKey([FromBody] StorePublicKeyRequestDTO request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.PublicKey))
                {
                    return BadRequest("Public key is required");
                }

                var userId = GetUserId();
                
                Logger.LogInformation("Storing public key for appUser {UserId}", userId);
                
                var result = await e2EeService.StoreUserPublicKeyAsync(userId.Value, request.PublicKey);
                
                if (result == null)
                {
                    return StatusCode(500, "Failed to store public key");
                }

                return Ok(new
                {
                    message = "Public key stored successfully",
                    keyVersion = result.KeyVersion,
                    createdAt = result.CreatedAt.ToString("O")
                });
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error storing public key");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get public keys for all participants in a conversation
        /// </summary>
        [HttpGet("conversation/{conversationId:int}/keys")]
        public async Task<IActionResult> GetConversationKeys(int conversationId)
        {
            try
            {
                var userId = GetUserId();
                
                Logger.LogInformation("Getting conversation keys for conversation {ConversationId}, appUser {UserId}", 
                    conversationId, userId);
                
                var result = await e2EeService.GetConversationKeysAsync(conversationId, userId.Value);
                
                if (result == null)
                {
                    return NotFound("Conversations not found or appUser not authorized");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error getting conversation keys for conversation {ConversationId}", conversationId);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Get public keys for specific users (for direct messages)
        /// </summary>
        [HttpPost("users/public-keys")]
        public async Task<IActionResult> GetPublicKeysForUsers([FromBody] List<int> userIds)
        {
            try
            {
                if (userIds == null || !userIds.Any())
                {
                    return BadRequest("AppUser IDs are required");
                }

                var userId = GetUserId();
                Logger.LogInformation("Getting public keys for users {UserIds}, requested by {UserId}", 
                    string.Join(",", userIds), userId);

                var result = await e2EeService.GetPublicKeysForUsersAsync(userIds);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error getting public keys for users");
                return StatusCode(500, "Internal server error");
            }
        }
        
        /// <summary>
        /// Get current appUser's public key (for checking E2EE setup status)
        /// </summary>
        [HttpGet("public-key")]
        public async Task<IActionResult> GetMyPublicKey()
        {
            try
            {
                var userId = GetUserId();
                var publicKeys = await e2EeService.GetPublicKeysForUsersAsync(new List<int> { userId.Value });
        
                if (!publicKeys.Any())
                {
                    return NotFound("No public key found for appUser");
                }

                return Ok(publicKeys.First());
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error getting appUser's public key");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("secret-key")]
        public async Task<IActionResult> SetSecret([FromBody] SecretKeyPhraseDTO dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);
                
                var userId = GetUserId();
                if (!userId.HasValue)
                    return Unauthorized("AppUser Id not found");

                var deviceId = HttpContext.GetDeviceId();
                var timestamp = DateTime.UtcNow;

                if (string.IsNullOrEmpty(deviceId))
                    return BadRequest("DeviceId not found");
                
                string secretName = $"appUser-{userId.Value}-{timestamp:yyyyMMddHHmmss}";

                Logger.LogInformation($"Storing recovery seed for appUser {userId} with device {deviceId}");

                var secret = new KeyVaultSecret(secretName, dto.Key)
                {
                    Properties =
                    {
                        Tags =
                        {
                            ["userId"] = userId.Value.ToString(),
                            ["device"] = deviceId,
                            ["createdAt"] = timestamp.ToString("O"),
                            ["version"] = timestamp.Ticks.ToString()
                        },
                        ContentType = "recovery-seed"
                    }
                };

                await secretClient.SetSecretAsync(secret);

                Logger.LogInformation($"Recovery seed sent succesfully for appUser {userId}");

                var respone = new SecretKeyResponseDTO
                {
                    Message = "Recovery seed stored successfully",
                    UserId = userId.Value,
                    DeviceId = deviceId,
                };

                return Ok(respone);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, $"Error Secret Key: {ex}");
                return StatusCode(500, $"Error Secret Key: {ex}");
            }
        }
    }
}