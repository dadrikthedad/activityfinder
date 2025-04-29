using System.Security.Claims;
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

    [HttpPost]
    public async Task<IActionResult> AddReaction([FromBody] ReactionRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        await _reactionService.AddReactionAsync(request.MessageId, userId, request.Emoji);
        return Ok();
    }

    [HttpDelete]
    public async Task<IActionResult> RemoveReaction([FromQuery] int messageId, [FromQuery] string emoji)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        await _reactionService.RemoveReactionAsync(messageId, userId, emoji);
        return Ok();
    }
}

public class ReactionRequest
{
    public int MessageId { get; set; }
    public string Emoji { get; set; } = string.Empty;
}
