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

    public MessageNotificationsController(ApplicationDbContext context)
    {
        _context = context;
    }
    
    // Henter alle Notifications
    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = GetUserId();

        var notifications = await _context.MessageNotifications
            .Where(n => n.UserId == userId)
            .Include(n => n.FromUser)
            .Include(n => n.Message)
            .Include(n => n.Conversation)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        var dtoList = notifications.Select(MapToDTO).ToList();
        return Ok(dtoList);
    }
    
    // Henter alle uleste notifications
    [HttpGet("unread")]
    public async Task<IActionResult> GetUnreadNotifications()
    {
        var userId = GetUserId();

        var unreadNotifications = await _context.MessageNotifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .Include(n => n.FromUser)
            .Include(n => n.Message)
            .Include(n => n.Conversation)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        var dtoList = unreadNotifications.Select(MapToDTO).ToList();
        return Ok(dtoList);
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
    
    // Leser alle notifications
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
    
    // Sette en notification som lest
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

        var dto = MapToDTO(notification);
        return Ok(dto);
    }
    
    
    // Hente ID
    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                         ?? throw new Exception("Ugyldig bruker"));
    }

    private MessageNotificationDTO MapToDTO(MessageNotification n)
    {
        return new MessageNotificationDTO
        {
            Id = n.Id,
            Type = n.Type,
            CreatedAt = n.CreatedAt,
            IsRead = n.IsRead,
            ReadAt = n.ReadAt,
            MessageId = n.MessageId,
            ConversationId = n.ConversationId,
            SenderName = n.FromUser?.FullName,
            GroupName = n.Conversation?.GroupName,
            MessagePreview = n.Message?.Text?.Length > 40 
                ? n.Message.Text.Substring(0, 40) + "..."
                : n.Message?.Text
        };
    }
}