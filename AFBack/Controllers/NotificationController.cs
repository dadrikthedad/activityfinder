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
    private readonly ApplicationDbContext _context;

    public NotificationController(ApplicationDbContext context)
    {
        _context = context;
    }

    // 🔸 Hent notifikasjoner for den innloggede brukeren
    [HttpGet]
    public async Task<ActionResult<List<NotificationDTO>>> GetNotifications()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        var notifications = await _context.Notifications
            .Include(n => n.RelatedUser)
            .ThenInclude(u => u.Profile)
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(); // materialiserer resultatet
        
        var result = notifications.Select(n =>
        {
            #pragma warning disable CS8600 // Converting null literal or possible null value to non-nullable type
            UserSummaryDTO? relatedUser = null;
            #pragma warning restore CS8600
            
            if (n.RelatedUser != null)
            {
                relatedUser = new UserSummaryDTO
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
                RelatedUser = relatedUser
            };
        }).ToList();

        return Ok(result);
    }
    
    // Her her vi de 15 notifications som skal vises i navbaren
    [HttpGet("navbar")]
    public async Task<ActionResult<List<NotificationDTO>>> GetNavbarNotifications()
    {
        var userId = GetUserId();
        if (userId == null) return Forbid();

        var notifications = await _context.Notifications
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(15)
            .ToListAsync();

        return Ok(MapToDtOs(notifications));
    }
    
    // Her her vi de 100 notifications som skal vises i hvis vi går via navbaren inn på notifications
    [HttpGet("page")]
    public async Task<ActionResult<List<NotificationDTO>>> GetPageNotifications()
    {
        var userId = GetUserId();
        if (userId == null) return Forbid();

        var notifications = await _context.Notifications
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(100)
            .ToListAsync();

        return Ok(MapToDtOs(notifications));
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
    private List<NotificationDTO> MapToDtOs(List<Notification> notifications)
    {
        return notifications.Select(n =>
        {
            UserSummaryDTO? relatedUser = null;

            if (n.RelatedUser != null)
            {
                relatedUser = new UserSummaryDTO
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
                RelatedUser = relatedUser
            };
        }).ToList();
    }
}

