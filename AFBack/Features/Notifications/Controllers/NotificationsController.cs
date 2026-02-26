using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Common.DTOs;
using AFBack.Features.Notifications.DTOs.Responses;
using AFBack.Features.Notifications.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Notifications.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController(
    INotificationService notificationService) : BaseController
{
    /// <summary>
    /// Henter paginerte notifikasjoner for innlogget bruker
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<NotificationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<PaginatedResponse<NotificationResponse>>> GetNotifications(
        [FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();
        
        var result = await notificationService.GetNotificationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter antall uleste notifikasjoner for innlogget bruker
    /// </summary>
    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        var userId = User.GetUserId();
    
        var count = await notificationService.GetUnreadCountAsync(userId);
    
        return Ok(count);
    }
    
    /// <summary>
    /// Markerer en notifikasjon som lest
    /// </summary>
    [HttpPatch("{notificationId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAsRead(
        [FromRoute]
        [Required(ErrorMessage = "NotificationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "NotificationId must be greater than 0")]
        int notificationId)
    {
        var userId = User.GetUserId();
        
        var result = await notificationService.MarkAsReadAsync(userId, notificationId);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return NoContent();
    }
    
    /// <summary>
    /// Markerer alle notifikasjoner som lest for innlogget bruker
    /// </summary>
    [HttpPatch("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = User.GetUserId();
    
        var result = await notificationService.MarkAllAsReadAsync(userId);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return NoContent();
    }
    
    /// <summary>
    /// Sletter en notifikasjon
    /// </summary>
    [HttpDelete("{notificationId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> DeleteNotification(
        [FromRoute]
        [Required(ErrorMessage = "NotificationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "NotificationId must be greater than 0")]
        int notificationId)
    {
        var userId = User.GetUserId();
        
        var result = await notificationService.DeleteNotificationAsync(userId, notificationId);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return NoContent();
    }
    
    /// <summary>
    /// Sletter alle notifikasjoner for innlogget bruker
    /// </summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> DeleteAllNotifications()
    {
        var userId = User.GetUserId();
        
        var result = await notificationService.DeleteAllNotificationsAsync(userId);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return NoContent();
    }
}
