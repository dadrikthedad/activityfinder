using System.ComponentModel.DataAnnotations;
using AFBack.Common.DTOs;
using AFBack.Controllers;
using AFBack.Features.Messaging.DTOs.Request;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Interface;
using AFBack.Infrastructure.Constants;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.Messaging.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("messaging")]
public class MessageController(
    ISendMessageService sendMessageService,
    IMessageQueryService messageQueryService)
    : BaseController
{
    
    /// <summary>
    /// Henter meldinger for en samtale med paginering.
    /// Meldingene returneres sortert nyeste først.
    /// </summary>
    [HttpGet("{conversationId:int}")]
    [ProducesResponseType(typeof(MessagesResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<MessagesResponse>> GetMessages(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId,
        [FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();
        
        var result = await messageQueryService.GetMessagesAsync(userId, conversationId, request.Page, request.PageSize);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter meldinger for flere samtaler samtidig - optimalisert for initial load.
    /// Returnerer de nyeste meldingene for hver samtale.
    /// </summary>
    [HttpPost("batch")]
    [ProducesResponseType(typeof(Dictionary<int, List<MessageResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<Dictionary<int, List<MessageResponse>>>> GetMessagesForConversations(
        [FromBody] GetMessagesForConversationsRequest request)
    {
        var userId = User.GetUserId();
        
        var result = await messageQueryService.GetMessagesForConversationsAsync(
            userId, request.ConversationIds, request.MessagesPerConversation);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Sender en melding til en eksisterende samtale.
    /// Krever at brukeren er deltaker med Accepted status.
    /// </summary>
    [EnableRateLimiting(RateLimitPolicies.Messaging)]
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
    
    /// <summary>
    /// Sletter en melding (soft delete). Kun avsender kan slette egne meldinger.
    /// Sender SignalR til alle aksepterte deltakere og oppretter SyncEvents.
    /// </summary>
    [HttpDelete("{messageId:int}")]
    [ProducesResponseType( StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteMessage(
        [FromRoute]
        [Required(ErrorMessage = "MessageId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "MessageId must be greater than 0")]
        int messageId)
    {
        var userId = User.GetUserId();
        
        var result = await messageQueryService.DeleteMessageAsync(userId, messageId);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return NoContent();
    }
}
