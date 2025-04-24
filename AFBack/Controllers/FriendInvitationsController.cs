using System.Security.Claims;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;
// Kontroller for venneforespørsel mellom to brukere
[ApiController]
[Route("api/friendinvitations")]
[Authorize]
public class FriendInvitationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public FriendInvitationsController(ApplicationDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    // POST: Send venneforespørsel
    [HttpPost]
    public async Task<IActionResult> SendInvitation([FromBody] SendFriendRequestDTO dto)
    {   
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid user ID in token." });
        
        // Hindre å legge til seg selv
        if (userId == dto.ReceiverId)
            return BadRequest("You can't send a friend request to yourself.");
    
        // Hindre ny forespørsel hvis det finnes en aktiv i noen retning
        var existingPending = await _context.FriendInvitations
            .AnyAsync(x =>
                ((x.SenderId == userId && x.ReceiverId == dto.ReceiverId) ||
                 (x.SenderId == dto.ReceiverId && x.ReceiverId == userId)) &&
                x.Status == InvitationStatus.Pending);


        if (existingPending)
        {
            return BadRequest("A friend request is already pending between these users.");
        }
        // Sjekker om mottaker eksisterer
        var receiverExists = await _context.Users.AnyAsync(u => u.Id == dto.ReceiverId);
        if (!receiverExists)
            return NotFound("Receiver not found.");

        var invitation = new FriendInvitation
        {
            SenderId = userId,
            ReceiverId = dto.ReceiverId,
            Status = InvitationStatus.Pending,
            SentAt = DateTime.UtcNow
        };

        _context.FriendInvitations.Add(invitation);
        
        // 🔔 Legg til notifikasjonen
        await _notificationService.CreateNotificationAsync(
            recipientUserId: dto.ReceiverId,
            relatedUserId: userId,
            type: NotificationTypes.FriendRequest
        );
        
        await _context.SaveChangesAsync();

        return Ok(new { message = "Friend request sent." });
    }

    // GET: Hent mottatte forespørsler
    [HttpGet("received")]
    public async Task<ActionResult<List<FriendInvitationDTO>>> GetReceivedInvitations()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var invitations = await _context.FriendInvitations
            .Where(i => i.ReceiverId == userId && i.Status == InvitationStatus.Pending)
            .Include(i => i.Sender)
            .ThenInclude(u => u.Profile)
            .AsNoTracking()
            .Select(i => new FriendInvitationDTO
            {
                Id = i.Id,
                ReceiverId = i.ReceiverId,
                Status = i.Status.ToString(),
                SentAt = i.SentAt,
                UserSummary = new UserSummaryDTO
                {
                    Id = i.Sender.Id,
                    FullName = i.Sender.FullName,
                    ProfileImageUrl = i.Sender.Profile != null ? i.Sender.Profile.ProfileImageUrl : null
                }
            })
            .ToListAsync();

        return Ok(invitations);
    }

    // PATCH: Godta forespørsel
    [HttpPatch("{id}/accept")]
    public async Task<IActionResult> AcceptInvitation(int id)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var invitation = await _context.FriendInvitations.FindAsync(id);
        if (invitation == null || invitation.Status != InvitationStatus.Pending)
            return NotFound("Invitation not found or already handled.");
        
        // Kun mottaker av en forespørsel kan godta
        if (invitation.ReceiverId != userId)
            return Forbid("You are not authorized to accept this invitation.");

        invitation.Status = InvitationStatus.Accepted;

        // Opprett faktisk vennskap
        var newFriend = new Friends
        {
            UserId = invitation.SenderId,
            FriendId = invitation.ReceiverId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Friends.Add(newFriend);
        await _context.SaveChangesAsync();

        return Ok("Friend request accepted.");
    }

    // PATCH: Avslå forespørsel
    [HttpPatch("{id}/decline")]
    public async Task<IActionResult> DeclineInvitation(int id)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var invitation = await _context.FriendInvitations.FindAsync(id);
        if (invitation == null || invitation.Status != InvitationStatus.Pending)
            return NotFound("Invitation not found or already handled.");
        
        if (invitation.ReceiverId != userId)
            return Forbid("You are not authorized to decline this invitation.");

        invitation.Status = InvitationStatus.Declined;
        await _context.SaveChangesAsync();

        return Ok("Friend request declined.");
    }
    
    // GET: Hent status mellom to brukere
    [HttpGet("between/{otherUserId}")]
    public async Task<IActionResult> GetStatusBetweenUsers(int otherUserId)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Unauthorized(new { message = "Invalid user ID in token." });
        }
        
        var invitation = await _context.FriendInvitations
            .Where(x =>
                (x.SenderId == userId && x.ReceiverId == otherUserId) ||
                (x.SenderId == otherUserId && x.ReceiverId == userId))
            .OrderByDescending(x => x.SentAt)
            .FirstOrDefaultAsync();

        if (invitation == null)
            return Ok(new { status = "none" });

        return Ok(new
        {
            status = invitation.Status.ToString().ToLower(),
            senderId = invitation.SenderId,
            receiverId = invitation.ReceiverId,
            sentAt = invitation.SentAt
        });
    }
    
}
