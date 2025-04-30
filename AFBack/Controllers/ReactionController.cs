using System.Security.Claims;
using AFBack.DTOs;
using AFBack.Helpers;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReactionController : ControllerBase
{
    private readonly IReactionService _reactionService;

    public ReactionController(IReactionService reactionService)
    {
        _reactionService = reactionService;
    }
    
    // legger til en reaksjon på en melding
    [HttpPost]
    public async Task<IActionResult> AddReaction([FromBody] ReactionRequest request)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId))
            return Unauthorized("Bruker-ID mangler eller har feil format i token.");

        try
        {
            await _reactionService.AddReactionAsync(request.MessageId, userId, request.Emoji);
            return Ok(new { message = "Reaksjon lagt til." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Noe gikk galt ved lagring av reaksjon.", details = ex.Message });
        }
    }
    // Henter alle tilgjengelig emojier
    [HttpGet("available-reactions")]
    public IActionResult GetAvailableReactions()
    {
        return Ok(AllowedReactions.Emojis);
    }
    
}

