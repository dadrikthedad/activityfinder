using System.Security.Claims;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReactionController : BaseController
{
    private readonly IReactionService _reactionService;

    public ReactionController(ApplicationDbContext context, IReactionService reactionService) : base(context)
    {
        _reactionService = reactionService;
    }
    
    // legger til en reaksjon på en melding
    [HttpPost]
    public async Task<IActionResult> AddReaction([FromBody] ReactionRequest request)
    {
        int senderId = GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated");

        try
        {
            await _reactionService.AddReactionAsync(request.MessageId, senderId, request.Emoji);
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
    
}

