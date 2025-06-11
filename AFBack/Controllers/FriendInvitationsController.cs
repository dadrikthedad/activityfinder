using System.Security.Claims;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace AFBack.Controllers;
// Kontroller for venneforespørsel mellom to brukere
[ApiController]
[Route("api/friendinvitations")]
[Authorize]
public class FriendInvitationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<NotificationHub> _hubContext;
    

    public FriendInvitationsController(ApplicationDbContext context, INotificationService notificationService, IHubContext<NotificationHub> hubContext)
    {
        _context = context;
        _notificationService = notificationService;
        _hubContext = hubContext;
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

        try
        {
            _context.FriendInvitations.Add(invitation);
            await _context.SaveChangesAsync();

            await _notificationService.CreateNotificationAsync(
                recipientUserId: dto.ReceiverId,
                relatedUserId: userId,
                type: NotificationEntityType.FriendInvitation,
                friendInvitationId: invitation.Id
            );

            return Ok(new { message = "Friend request sent." });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error while handling friend invitation send to {ReceiverId} by {SenderId}", dto.ReceiverId, userId);
            return StatusCode(500, "An error occurred on the server.");
        }
        
    }
    
    /* ---------- HENT ÉN INVITASJON ---------- */
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FriendInvitationDTO>> GetInvitationById(int id)
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized();

        var inv = await _context.FriendInvitations
            .Include(i => i.Sender).ThenInclude(u => u.Profile)
            .FirstOrDefaultAsync(i =>
                i.Id == id &&
                (i.ReceiverId == userId || i.SenderId == userId)); // sikkerhet

        if (inv == null) return NotFound();

        return Ok(ToDto(inv));
    }

    /* ---------- HENT ALLE (eksisterende) ---------- */
    [HttpGet("received")]
    public async Task<ActionResult<List<FriendInvitationDTO>>> GetReceivedInvitations()
    {
        if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return Unauthorized(new { message = "Invalid user ID in token." });

        // 1) hent fra databasen
        var dbList = await _context.FriendInvitations
            .Where(i => i.ReceiverId == userId && i.Status == InvitationStatus.Pending)
            .Include(i => i.Sender).ThenInclude(u => u.Profile)
            .AsNoTracking()
            .ToListAsync();                       // nå funker ToListAsync()

        // 2) projiser til DTO på klientsiden
        var dtoList = dbList.Select(ToDto).ToList(); // OK for EF Core ≥ 3

        return Ok(dtoList);
    }

    /* ---------- Felles DTO-mapping ---------- */
    private static FriendInvitationDTO ToDto(FriendInvitation inv) =>
        new()
        {
            Id         = inv.Id,
            ReceiverId = inv.ReceiverId,
            Status     = inv.Status.ToString().ToLower(), // "pending"/"accepted"/"declined"
            SentAt     = inv.SentAt,
            UserSummary = new UserSummaryDTO
            {
                Id              = inv.Sender.Id,
                FullName        = inv.Sender.FullName,
                ProfileImageUrl = inv.Sender.Profile?.ProfileImageUrl
            }
        };

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
        
        await _notificationService.CreateNotificationAsync(
            recipientUserId: invitation.SenderId,
            relatedUserId: invitation.ReceiverId,
            type: NotificationEntityType.FriendInvAccepted,
            friendInvitationId: invitation.Id
        );
        
        // Sjekk om det allerede finnes en meldingsforespørsel
        var existingMessageRequest = await _context.MessageRequests
            .Include(mr => mr.Conversation)
            .FirstOrDefaultAsync(r => 
                ((r.SenderId == invitation.SenderId && r.ReceiverId == invitation.ReceiverId) ||
                 (r.SenderId == invitation.ReceiverId && r.ReceiverId == invitation.SenderId)) &&
                !r.IsAccepted);

        int? conversationId = null;


        if (existingMessageRequest != null)
        {
            // Oppdater eksisterende meldingsforespørsel
            existingMessageRequest.IsAccepted = true;
            conversationId = existingMessageRequest.ConversationId;

            // Sett samtalen til godkjent
            if (existingMessageRequest.Conversation != null)
            {
                existingMessageRequest.Conversation.IsApproved = true;
            }
        }

        await _context.SaveChangesAsync();

        var responseData = new 
        { 
            message = "Friend request accepted.",
            conversationId,
        };

        return Ok(responseData);
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
