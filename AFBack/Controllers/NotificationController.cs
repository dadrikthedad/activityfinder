using AFBack.Services;
using Microsoft.AspNetCore.Authorization;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using System.Security.Claims;

// Kontroller for Notifications
[ApiController]
[Route("api/notifications")]
[Authorize] 
public class NotificationController : BaseController
{
    private readonly INotificationService _notificationService;

    public NotificationController(ApplicationDbContext context, INotificationService notificationService) :  base(context)
    {
        _notificationService = notificationService;
    }
    
    /* ---------- HENT ENKELT NOTIFIKASJON ---------- */
    [HttpGet("{id:int}")]
    public async Task<ActionResult<NotificationDTO>> GetNotificationById(int id)
    {
        // 1. Finn innlogget bruker
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        // 2. Hent notifikasjonen + RelatedUser
        var n = await _context.Notifications
            .Include(x => x.RelatedUser).ThenInclude(u => u.Profile)
            .FirstOrDefaultAsync(x => x.Id == id && x.RecipientUserId == userId);

        if (n == null) return NotFound();

        // 3. Projiser til DTO og returner
        return Ok(ToDto(n));
    }

    /* ---------- EKST. PAGINERT LISTE (uendret) ---------- */
    [HttpGet]
    [HttpGet]
    public async Task<ActionResult<List<NotificationDTO>>> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        if (page <= 0 || pageSize <= 0) 
            return BadRequest("Page and pageSize must be positive integers.");
        
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        // 🎯 ENKEL: Bruk service i stedet for direkte database-kall
        var notifications = await _notificationService.GetUserNotificationsAsync(userId, page, pageSize);
        return Ok(notifications);
    }
    
    // Setter alle notifications som lest slik at bruker ikke trenger å se varslene i høyre hjørnet
    [HttpPost("mark-all-as-read")]
    [Authorize]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var updatedCount = await _context.Notifications
            .Where(n => n.RecipientUserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(setters =>
                setters.SetProperty(n => n.IsRead, true));

        return Ok(new
        {
            message = "All notifications marked as read.",
            updatedCount
        });
    }
    
    // Her kan vi slette notifications hvis en bruker ønsker det
    [HttpDelete("delete-all")]
    [Authorize]
    public async Task<IActionResult> DeleteAllNotifications()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Forbid();

        var deletedCount = await _context.Notifications
            .Where(n => n.RecipientUserId == userId)
            .ExecuteDeleteAsync();

        return Ok(new
        {
            message = "All notifications deleted.",
            deletedCount
        });
    }
    
    // Hjelpe funksjon til å lage en Notification
    private static NotificationDTO ToDto(Notification n)
    {
        UserSummaryDTO? related = null;

        if (n.RelatedUser != null)
        {
            related = new UserSummaryDTO
            {
                Id = n.RelatedUser.Id,
                FullName = n.RelatedUser.FullName,
                ProfileImageUrl = n.RelatedUser.Profile?.ProfileImageUrl
            };
        }

        return new NotificationDTO
        {
            Id = n.Id,
            Type = n.Type,
            Message = n.Message,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt,
            PostId = n.PostId,
            CommentId = n.CommentId,
            FriendInvitationId = n.FriendInvitationId,
            EventInvitationId = n.EventInvitationId,
            RelatedUser = related
        };
    }
  
}

