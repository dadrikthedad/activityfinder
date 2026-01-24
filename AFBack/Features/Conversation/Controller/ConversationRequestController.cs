using AFBack.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Conversation.Controller;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ConversationRequestController : BaseController
{
    public async Task<ActionResult<ProblemDetails>> CreateConversation([FromBody] CreateConversationRequest request)
    {
        var userId = User.GetUserId();

        var result = await newConversationService.CreateConversationAsync(request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
