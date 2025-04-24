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
public class NotificationController : ControllerBase
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
}

