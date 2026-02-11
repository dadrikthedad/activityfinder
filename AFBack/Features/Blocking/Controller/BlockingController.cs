using System.ComponentModel.DataAnnotations;
using AFBack.Controllers;
using AFBack.Features.Blocking.DTOs;
using AFBack.Features.Blocking.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Blocking.Controller;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BlockingController(IBlockingService blockingService) : BaseController
{
    /// <summary>
    /// Bruker A blokkerer bruker B. Bruker hentes fra JWT og bruker B er medsendt. Sletter samtalen fra CanSend
    /// hvis brukerene har en 1-1 samtale
    /// </summary>
    /// <param name="userToBlockId">Brukeren som skal bli blokkert</param>
    /// <returns>NoContent 204</returns>
    [HttpPost("{userToBlockId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> BlockUser(
        [FromRoute] 
        [Required(ErrorMessage = "userToBlockId is required")]
        string userToBlockId)
    {
        var userId = User.GetUserId(); 
        
        var result = await blockingService.BlockUserAsync(userId, userToBlockId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Bruker A fjerner blokkering på  bruker B. Bruker hentes fra JWT og bruker B er medsendt.
    /// Legger samtalen tilbake i CanSend hvis brukerene har en 1-1 samtale
    /// </summary>
    /// <param name="userToUnblockId">Brukeren som ikke skal være blokkert lenger</param>
    /// <returns>NoContent 204</returns>
    [HttpDelete("unblock/{userToUnblockId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UnblockUser(
        [FromRoute] 
        [Required(ErrorMessage = "userToUnblockId is required")]
        string userToUnblockId)
    {
        var userId = User.GetUserId(); 
        
        var result = await blockingService.UnblockUserAsync(userId, userToUnblockId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Henter alle brukere som innlogget bruker har blokkert
    /// </summary>
    /// <returns>Liste med blokkerte brukere</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<BlockedUserResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBlockedUsers()
    {
        var userId = User.GetUserId();
        
        var result = await blockingService.GetBlockedUsersAsync(userId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
