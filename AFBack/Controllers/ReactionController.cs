using System.Security.Claims;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Features.Cache;
using AFBack.Features.Cache.Interface;
using AFBack.Infrastructure.Services;
using AFBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReactionController(
    AppDbContext context,
    IReactionService reactionService,
    ILogger<ReactionController> logger,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<ReactionController>(context, logger, userCache, responseService)
{
    // legger til en reaksjon på en melding
    [HttpPost]
    public async Task<IActionResult> AddReaction([FromBody] ReactionRequest request)
    {
        int senderId = GetUserId() ?? throw new UnauthorizedAccessException("AppUser not authenticated");

        try
        {
            await reactionService.AddReactionAsync(request.MessageId, senderId, request.Emoji);
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

