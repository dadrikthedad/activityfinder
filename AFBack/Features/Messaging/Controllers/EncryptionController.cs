using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;


namespace AFBack.Features.Messaging.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class EncryptionController(IEncryptionService encryptionService) : BaseController
{
    /// <summary>
    /// Lagre eller oppdatere PublicKey for en bruker
    /// </summary>
    [HttpPost("public-key")]
    [ProducesResponseType(typeof(StoreUserPublicKeyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<StoreUserPublicKeyResponse>> StorePublicKey(StorePublicKeyRequest request)
    {
        var userId = User.GetUserId();
        var result = await encryptionService.StoreUserPublicKeyAsync(userId, request.PublicKey);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Hent public keys for alle deltakere i en samtale
    /// </summary>
    [HttpGet("conversation/{conversationId:int}/keys")]
    [ProducesResponseType(typeof(ConversationKeysResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ConversationKeysResponse>> GetConversationKeys(
        [FromRoute] 
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")] 
        int conversationId)
    {
        var userId = User.GetUserId();
        var result = await encryptionService.GetConversationKeysAsync(userId, conversationId);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Hent public keys for spesifikke brukere (for nye samtaler)
    /// </summary>
    [HttpPost("users/public-keys")]
    [ProducesResponseType(typeof(List<UserPublicKeyResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<UserPublicKeyResponse>>> GetPublicKeysForUsers(
        [FromBody] GetPublicKeysForUsersRequest request)
    {
        var result = await encryptionService.GetPublicKeysForUsersAsync(request.UserIds);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Hent egen public key (for å sjekke E2EE-status)
    /// </summary>
    [HttpGet("public-key")]
    [ProducesResponseType(typeof(UserPublicKeyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserPublicKeyResponse>> GetMyPublicKey()
    {
        var userId = User.GetUserId();
        var result = await encryptionService.GetMyPublicKeyAsync(userId);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Lagre recovery seed i Azure Key Vault
    /// </summary>
    [HttpPost("recovery-seed")]
    [ProducesResponseType( StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StoreRecoverySeed(StoreRecoverySeedRequest request)
    {
        var userId = User.GetUserId();
        var deviceId = User.GetDeviceId();

        var result = await encryptionService.StoreRecoverySeedAsync(userId, deviceId, request.Key);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok();
    }
    
}
