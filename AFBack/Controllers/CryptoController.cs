using System.Security.Claims;
using AFBack.DTOs.Crypto;
using AFBack.Extensions;
using AFBack.Services.Crypto;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require authentication for all E2EE endpoints
    public class E2EEController : BaseController
    {
        private readonly E2EEService _e2eeService;
        private readonly ILogger<E2EEController> _logger;
        private readonly SecretClient _secretClient;

        public E2EEController(E2EEService e2eeService, ILogger<E2EEController> logger, SecretClient secretClient)
        {
            _e2eeService = e2eeService;
            _logger = logger;
            _secretClient = secretClient;
        }

        /// <summary>
        /// Store or update user's public key for E2EE
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
                
                _logger.LogInformation("Storing public key for user {UserId}", userId);
                
                var result = await _e2eeService.StoreUserPublicKeyAsync(userId.Value, request.PublicKey);
                
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
                _logger.LogError(ex, "Error storing public key");
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
                
                _logger.LogInformation("Getting conversation keys for conversation {ConversationId}, user {UserId}", 
                    conversationId, userId);
                
                var result = await _e2eeService.GetConversationKeysAsync(conversationId, userId.Value);
                
                if (result == null)
                {
                    return NotFound("Conversation not found or user not authorized");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting conversation keys for conversation {ConversationId}", conversationId);
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
                    return BadRequest("User IDs are required");
                }

                var userId = GetUserId();
                _logger.LogInformation("Getting public keys for users {UserIds}, requested by {UserId}", 
                    string.Join(",", userIds), userId);

                var result = await _e2eeService.GetPublicKeysForUsersAsync(userIds);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting public keys for users");
                return StatusCode(500, "Internal server error");
            }
        }
        
        /// <summary>
        /// Get current user's public key (for checking E2EE setup status)
        /// </summary>
        [HttpGet("public-key")]
        public async Task<IActionResult> GetMyPublicKey()
        {
            try
            {
                var userId = GetUserId();
                var publicKeys = await _e2eeService.GetPublicKeysForUsersAsync(new List<int> { userId.Value });
        
                if (!publicKeys.Any())
                {
                    return NotFound("No public key found for user");
                }

                return Ok(publicKeys.First());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user's public key");
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
                    return Unauthorized("User Id not found");

                var deviceId = HttpContext.GetDeviceId();
                var timestamp = DateTime.UtcNow;

                if (string.IsNullOrEmpty(deviceId))
                    return BadRequest("DeviceId not found");
                
                string secretName = $"user-{userId.Value}-{timestamp:yyyyMMddHHmmss}";

                _logger.LogInformation($"Storing recovery seed for user {userId} with device {deviceId}");

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

                await _secretClient.SetSecretAsync(secret);

                _logger.LogInformation($"Recovery seed sent succesfully for user {userId}");

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
                _logger.LogError(ex, $"Error Secret Key: {ex}");
                return StatusCode(500, $"Error Secret Key: {ex}");
            }
        }
        
        [AllowAnonymous]
        [HttpPost("test-secret")]
        public async Task<IActionResult> TestSecret([FromBody] TestDto dto)
        {
            try
            {
                _logger.LogInformation($"Storing recovery seed for user with device");
                var secret = new KeyVaultSecret("bra", dto.Key);
                await _secretClient.SetSecretAsync(secret);
                _logger.LogInformation($"Recovery seed sent succesfully for user");
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error Secret Key: {ex}");
                return StatusCode(500, $"Error Secret Key: {ex}");
            }
        }
    }

    public class TestDto
    {
        public string Key { get; set; } = "Test10000000000000000000";
    }
}