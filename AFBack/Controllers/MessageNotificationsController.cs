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
    private readonly MessageNotificationService _notificationService;

    public MessageNotificationsController(ApplicationDbContext context, MessageNotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }
    
    // Henter alle Notifications
    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();

        if (page < 1 || pageSize <= 0)
            return BadRequest("Ugyldig pagineringsverdi.");

        var query = _context.MessageNotifications
            .Where(n => n.UserId == userId)
            .Include(n => n.FromUser)
            .Include(n => n.Message!)
            .ThenInclude(m => m.Reactions)
            .Include(n => n.Conversation)
            .OrderByDescending(n => n.CreatedAt);

        var totalCount = await query.CountAsync();
        var notifications = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        
        // 👇 Samle conversationId-er fra notificationene
        var conversationIds = notifications
            .Where(n => n.ConversationId.HasValue)
            .Select(n => n.ConversationId!.Value)
            .Distinct()
            .ToList();
        
        // ✅ Slå opp alle rejected MessageRequests én gang
        var rejectedMessageConversations = await _context.MessageRequests
            .Where(r =>
                conversationIds.Contains(r.ConversationId!.Value) &&
                r.ReceiverId == userId &&
                r.IsRejected)
            .Select(r => r.ConversationId!.Value)
            .Distinct()
            .ToListAsync();
        
        // ✅ Slå opp alle rejected GroupRequests én gang
        var rejectedGroupConversations = await _context.GroupRequests
            .Where(gr =>
                conversationIds.Contains(gr.ConversationId) &&
                gr.ReceiverId == userId &&
                gr.Status == GroupRequestStatus.Rejected)
            .Select(gr => gr.ConversationId)
            .Distinct()
            .ToListAsync();
        
        // 👇 Gjør om til HashSet for raskt oppslag
        var rejectedConversationSet = new HashSet<int>(
            rejectedMessageConversations.Concat(rejectedGroupConversations)
        );


        // 👇 Lag DTO-liste med status
        var dtoList = notifications
            .Select(n => _notificationService.MapToDTO(n, rejectedConversationSet))
            .ToList();

        return Ok(new
        {
            page,
            pageSize,
            totalCount,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            notifications = dtoList
        });
    }
    
    // Brukes denne?
    // // Henter alle uleste notifications
    // [HttpGet("unread")]
    // public async Task<IActionResult> GetUnreadNotifications()
    // {
    //     var userId = GetUserId();
    //
    //     var unreadNotifications = await _context.MessageNotifications
    //         .Where(n => n.UserId == userId && !n.IsRead)
    //         .Include(n => n.FromUser)
    //         .Include(n => n.Message)
    //         .Include(n => n.Conversation)
    //         .OrderByDescending(n => n.CreatedAt)
    //         .ToListAsync();
    //
    //     var dtoList = unreadNotifications.Select(_notificationService.MapToDTO).ToList();
    //     return Ok(dtoList);
    // }
    
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

        var dto = _notificationService.MapToDTO(notification);
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
    
    // Henter brukerne som har godkjent en samtale
    [HttpGet("group-approved-members/{conversationId}")]
    public async Task<IActionResult> GetGroupApprovedMembers(int conversationId)
    {
        var userId = GetUserId();
    
        // Sjekk tilgang
        var hasAccess = await _context.ConversationParticipants
            .AnyAsync(cp => cp.ConversationId == conversationId && cp.UserId == userId);
        
        if (!hasAccess)
            return Forbid("Du har ikke tilgang til denne samtalen");

        // Hent alle som har fått GroupRequestApproved for denne gruppen
        var approvedMembers = await _context.MessageNotifications
            .Where(n => n.ConversationId == conversationId && 
                        n.Type == NotificationType.GroupRequestApproved)
            .Include(n => n.FromUser)
            .ThenInclude(u => u.Profile)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new 
            {
                UserId = n.FromUserId,
                FullName = n.FromUser!.FullName,
                ProfileImageUrl = n.FromUser.Profile != null ? n.FromUser.Profile.ProfileImageUrl : null,
                JoinedAt = n.CreatedAt
            })
            .Distinct() // I tilfelle det er duplikater
            .ToListAsync();

        return Ok(approvedMembers);
    }
    
}