using System.ComponentModel.DataAnnotations;
using AFBack.Controllers;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Conversation.Controller;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class GroupConversationController(IGroupConversationService groupConversationService) : BaseController
{
    /// <summary>
    /// Oppretter en ny gruppesamtale med flere deltakere.
    /// Creator blir automatisk medlem med Creator-rolle.
    /// </summary>
    [HttpPost("create")]
    [ProducesResponseType(typeof(CreateGroupConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<CreateGroupConversationResponse>> CreateGroupConversation(
        [FromBody] CreateGroupConversationRequest request)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.CreateGroupConversationAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Aksepterer en gruppeinvitasjon.
    /// Brukeren må ha Pending status i samtalen.
    /// </summary>
    [HttpPost("{conversationId:int}/accept")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> AcceptGroupInvitation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.AcceptPendingGroupConversationRequestAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Avslår en gruppeinvitasjon.
    /// Brukeren må ha Pending status i samtalen.
    /// Brukeren blir fjernet fra gruppen og kan ikke bli invitert på nytt.
    /// </summary>
    [HttpPost("{conversationId:int}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RejectGroupInvitation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.RejectPendingGroupConversationRequestAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
   
    [HttpPost("{conversationId:int}/invite")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> InviteGroupMembers(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId, 
        [FromBody] InviteGroupMemberRequest request)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.InviteGroupMembersAsync(userId, conversationId, 
            request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
