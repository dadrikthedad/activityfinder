using System.Security.Claims;
using AFBack.Data;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessageNotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly GroupNotificationService _groupNotificationService;

    public MessageNotificationsController(ApplicationDbContext context, MessageNotificationService notificationService, GroupNotificationService groupNotificationService)
    {
        _context = context;
        _messageNotificationService = notificationService;
        _groupNotificationService = groupNotificationService;
    }

    
    // Henter alle Notifications
    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var userId = GetUserId();

            if (page < 1 || pageSize <= 0)
                return BadRequest("Ugyldig pagineringsverdi.");

            var (notifications, totalCount) = await _messageNotificationService.GetUserNotificationsAsync(
                userId, page, pageSize);

            return Ok(new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                notifications
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, "En feil oppstod ved henting av notifikasjoner.");
        }
    }
    
    // Henter alle samtaler hvor vi har uleste notifikasjoner
    [HttpGet("unread-conversations")]
    public async Task<IActionResult> GetUnreadConversationIds()
    {
        var userId = GetUserId();

        var unreadConvIds = await _context.MessageNotifications
            .Where(n => n.UserId == userId && !n.IsRead && n.ConversationId != null)
            .Select(n => n.ConversationId!.Value)
            .Distinct()
            .ToListAsync();

        return Ok(unreadConvIds);
    }
    
    // Henter antall uleste notifications
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadNotificationCount()
    {
        var userId = GetUserId();

        var count = await _context.MessageNotifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        return Ok(new { count });
    }
    
    // Leser en notificastion
    [HttpPost("mark-as-read/{id}")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var userId = GetUserId();

        var notification = await _context.MessageNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
            return NotFound();

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }
    
    // Setter alle notifikasjoner til en samtale lest
    [HttpPost("mark-conversation-as-read/{conversationId}")]
    public async Task<IActionResult> MarkConversationAsRead(int conversationId)
    {
        var userId = GetUserId();

        var unreadNotifications = await _context.MessageNotifications
            .Where(n => n.UserId == userId && !n.IsRead && n.ConversationId == conversationId)
            .ToListAsync();

        foreach (var n in unreadNotifications)
        {
            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return NoContent();
    }
    
    // Sette en notification som lest, men gir oss informasjonen om notifikasjonen. Slette?
    [HttpGet("read/{id}")]
    public async Task<IActionResult> ReadNotification(int id)
    {
        var userId = GetUserId();

        var notification = await _context.MessageNotifications
            .Include(n => n.FromUser)
            .Include(n => n.Message)
            .Include(n => n.Conversation)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
            return NotFound();

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        var dto = _messageNotificationService.MapToDTO(notification);
        return Ok(dto);
    }
    
    // setter alle notifikasjoner som lest
    [HttpPost("mark-all-as-read")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();

        var unreadNotifications = await _context.MessageNotifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in unreadNotifications)
        {
            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
    
    
    // Hente ID
    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                         ?? throw new Exception("Ugyldig bruker"));
    }
}