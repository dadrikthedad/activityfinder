using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Common.DTOs;
using AFBack.Configurations.Options;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Services;
using AFBack.Features.FileHandling.DTOs.Requests;
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
        [FromForm] CreateGroupConversationRequest request)
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
    
    /// <summary>
    /// Forlater en gruppesamtale.
    /// Brukeren må ha Accepted status i samtalen.
    /// Brukeren blir fjernet fra gruppen og kan ikke bli invitert på nytt.
    /// </summary>
    [HttpPost("{conversationId:int}/leave")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> LeaveGroup(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.LeaveGroupConversationAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Henter alle grupper brukeren har forlatt eller avslått.
    /// Brukes for å vise en liste over grupper brukeren kan bli invitert til igjen.
    /// </summary>
    [HttpGet("left")]
    [ProducesResponseType(typeof(ConversationLeftRecordsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationLeftRecordsResponse>> GetLeftConversations(
        [FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.GetLeftConversationsAsync(userId, request.Page, request.PageSize);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Sletter en ConversationLeftRecord slik at brukeren kan bli invitert på nytt.
    /// </summary>
    [HttpDelete("left/{conversationId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> DeleteLeftConversationRecord(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await groupConversationService.DeleteLeftConversationRecordAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    // ======================== Bytte gruppenavn ======================== 
    
    /// <summary>
    /// Oppdaterer et gruppenavn for en samtale. Kun Creator har tilatelse
    /// </summary>
    /// <param name="conversationId">ID-en til samtalen</param>
    /// <param name="request">UpdateGroupNameRequest med gruppenavn</param>
    /// <returns></returns>
    [HttpPut("{conversationId:int}/groupname")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> UpdateGroupName(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId, 
        [FromBody] UpdateGroupNameRequest request)
    {
        var userId = User.GetUserId();
        var result = await groupConversationService.UpdateGroupNameAsync(userId, conversationId, request.GroupName);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }

    // ======================== Bytte gruppebilde ========================
    
    /// <summary>
    /// Bytter et gruppebilde for en samtale. Kun Creator som har tilattelse til det
    /// </summary>
    /// <param name="conversationId">ID-en til samtalen</param>
    /// <param name="request">ImageRequest - IFormFile bilde</param>
    /// <returns>200 Ok med oppdatert ConversationResponse</returns>
    [HttpPut("{conversationId:int}/groupimage")]
    [RequestSizeLimit(ImageFileConfig.MaxSizeInBytes)] 
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> ChangeGroupImage(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId, 
        [FromForm] ImageRequest request)
    {
        var userId = User.GetUserId();
        var result = await groupConversationService.UpdateGroupImageAsync(userId, conversationId, request.File);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Fjerner gruppebildet. Kun Creator har tilgang til dette.
    /// </summary>
    /// <returns>200 Ok</returns>
    [HttpDelete("{conversationId:int}/groupimage")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> RemoveGroupImage(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();
        var result = await groupConversationService.RemoveGroupImageAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    // ======================== Bytte groupdescription ========================
    
    /// <summary>
    /// Oppdaterer gruppebeskrivelsen. Kun Creator har tilattelse.
    /// Send null for å fjerne beskrivelsen.
    /// </summary>
    /// <returns>200 Ok med oppdatert ConversationResponse</returns>
    [HttpPut("{conversationId:int}/groupdescription")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> UpdateGroupDescription(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId,
        [FromBody] UpdateGroupDescriptionRequest request)
    {
        var userId = User.GetUserId();
        var result = await groupConversationService.UpdateGroupDescriptionAsync(userId, 
            conversationId, request.GroupDescription);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
