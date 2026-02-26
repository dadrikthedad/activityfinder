using AFBack.Common.Controllers;
using AFBack.Features.Reactions.DTOs.Requests;
using AFBack.Features.Reactions.DTOs.Responses;
using AFBack.Features.Reactions.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Reactions.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReactionController(IReactionService reactionService) : BaseController
{
    [HttpPost("add-reaction")]
    public async Task<ActionResult<ReactionAddedResponse>> AddReaction([FromBody] ReactionRequest request)
    {
        var userId = User.GetUserId();
        var result = await reactionService.AddReactionAsync(userId, request.ConversationId, 
            request.MessageId, request.Emoji);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }

}
