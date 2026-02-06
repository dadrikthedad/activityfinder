using System.ComponentModel.DataAnnotations;
using AFBack.Common.DTOs;
using AFBack.Controllers;
using AFBack.Features.MessageNotifications.DTOs;
using AFBack.Features.MessageNotifications.Service;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.MessageNotifications.Controller;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessageNotificationsController(
    IMessageNotificationQueryService messageNotificationQueryService,
    IMessageNotificationStateService messageNotificationStateService) : BaseController
{
    /// <summary>
    /// Henter paginerte meldingsnotifikasjoner for innlogget bruker
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<MessageNotificationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<PaginatedResponse<MessageNotificationResponse>>> GetNotifications(
        [FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();
        
        var result = await messageNotificationQueryService.GetNotificationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }

    /// <summary>
    /// Henter en enkelt meldingsnotifikasjon
    /// </summary>
    [HttpGet("{messageNotificationId:int}")]
    [ProducesResponseType(typeof(MessageNotificationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<MessageNotificationResponse>> GetMessageNotification(
        [FromRoute]
        [Required(ErrorMessage = "MessageNotificationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "MessageNotificationId must be greater than 0")]
        int messageNotificationId)
    {
        var userId = User.GetUserId();

        var result = await messageNotificationQueryService.GetMessageNotificationAsync(userId, messageNotificationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter alle notifikasjoner for en spesifikk samtale
    /// </summary>
    /// <param name="conversationId">Samtalens ID</param>
    /// <returns>Liste med notifikasjoner</returns>
    [HttpGet("conversation/{conversationId:int}")]
    [ProducesResponseType(typeof(List<MessageNotificationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<MessageNotificationResponse>>> GetNotificationsByConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await messageNotificationQueryService.GetNotificationsByConversationAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    
    /// <summary>
    /// Henter antall uleste notifikasjoner for innlogget bruker
    /// </summary>
    /// <returns>Antall uleste notifikasjoner</returns>
    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        var userId = User.GetUserId();
    
        var count = await messageNotificationQueryService.GetUnreadCountAsync(userId);
    
        return Ok(count);
    }
    
    /// <summary>
    /// Setter en MedlingsNotifikasjon som lest
    /// </summary>
    /// <param name="messageNotificationId">MessageNotification som brukeren har lest</param>
    /// <returns>204 No Content</returns>
    [HttpPatch("{messageNotificationId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAsRead(
        [FromRoute]
        [Required(ErrorMessage = "MessageNotificationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "MessageNotificationId must be greater than 0")]
        int messageNotificationId)
    {
        var userId = User.GetUserId();

        var result = await messageNotificationStateService.MarkAsReadAsync(userId, messageNotificationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Markerer alle uleste notifikasjoner som lest for en samtale
    /// </summary>
    /// <param name="conversationId">Samtalen som brukeren har lest</param>
    /// <returns>204 No Content</returns>
    [HttpPatch("conversation/{conversationId:int}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAllAsReadByConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await messageNotificationStateService.MarkAllAsReadByConversationAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Markerer alle uleste notifikasjoner som lest for innlogget bruker
    /// </summary>
    /// <returns>204 No Content</returns>
    [HttpPatch("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.GetUserId();

        var result = await messageNotificationStateService.MarkAllAsReadAsync(userId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
  
    
}
