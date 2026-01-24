using AFBack.Controllers;
using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Interface;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Messaging.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("messaging")]
public class SendMessageController(
    ISendMessageService sendMessageService)
    : BaseController
{
    
    
    // Hoved SendMessage metoden. Brukes kun fra samtalelisten til eksisterende samtaler. Krever ConversationId
    [HttpPost]
    [ProducesResponseType(typeof(SendMessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status410Gone)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<SendMessageResponse>> SendMessage([FromBody] MessageRequest request)
    {
        var userId = User.GetUserId(); 
        
        var result = await sendMessageService.SendMessageAsync(request, userId);

        if (result.IsFailure)
            return HandleFailure(result);
        
        // Returner Ok() hvis det var en suksess
        return Ok(result.Value);
    }
}
