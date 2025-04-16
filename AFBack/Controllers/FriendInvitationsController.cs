using AFBack.Data;
using AFBack.DTOs;
using AFBack.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;
// Kontroller for venneforespørsel mellom to brukere
[ApiController]
[Route("api/friendinvitations")]
public class FriendInvitationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FriendInvitationsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // POST: Send venneforespørsel
    [HttpPost]
    public async Task<IActionResult> SendInvitation([FromBody] FriendInvitationDTO dto)
    {   // Hindre å legge til seg selv
        if (dto.SenderId == dto.ReceiverId)
            return BadRequest("You can't send a friend request to yourself.");
    
        // Hindre ny forespørsel hvis det finnes en aktiv i noen retning
        var existingPending = await _context.FriendInvitations
            .AnyAsync(x =>
                ((x.SenderId == dto.SenderId && x.ReceiverId == dto.ReceiverId) ||
                 (x.SenderId == dto.ReceiverId && x.ReceiverId == dto.SenderId)) &&
                x.Status == InvitationStatus.Pending);

        if (existingPending)
        {
            return BadRequest("A friend request is already pending between these users.");
        }
        // Sjekker om brukerene eksisterer
        var senderExists = await _context.Users.AnyAsync(u => u.Id == dto.SenderId);
        var receiverExists = await _context.Users.AnyAsync(u => u.Id == dto.ReceiverId);
        if (!senderExists || !receiverExists)
            return NotFound("One or both users not found.");

        var invitation = new FriendInvitation
        {
            SenderId = dto.SenderId,
            ReceiverId = dto.ReceiverId,
            Status = InvitationStatus.Pending,
            SentAt = DateTime.UtcNow
        };

        _context.FriendInvitations.Add(invitation);
        await _context.SaveChangesAsync();

        return Ok("Friend request sent.");
    }

    // GET: Hent mottatte forespørsler
    [HttpGet("received/{userId}")]
    public async Task<ActionResult<List<FriendInvitationDTO>>> GetReceivedInvitations(int userId)
    {
        var invitations = await _context.FriendInvitations
            .Where(i => i.ReceiverId == userId && i.Status == InvitationStatus.Pending)
            .Select(i => new FriendInvitationDTO
            {
                Id = i.Id,
                SenderId = i.SenderId,
                ReceiverId = i.ReceiverId,
                Status = i.Status.ToString(),
                SentAt = i.SentAt
            })
            .ToListAsync();

        return Ok(invitations);
    }

    // PATCH: Godta forespørsel
    [HttpPatch("{id}/accept")]
    public async Task<IActionResult> AcceptInvitation(int id)
    {
        var invitation = await _context.FriendInvitations.FindAsync(id);
        if (invitation == null || invitation.Status != InvitationStatus.Pending)
            return NotFound("Invitation not found or already handled.");

        invitation.Status = InvitationStatus.Accepted;

        // Opprett faktisk vennskap
        var newFriend = new Friends
        {
            User = await _context.Users.FindAsync(invitation.SenderId)!,
            FriendUser = await _context.Users.FindAsync(invitation.ReceiverId)!,
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
        var invitation = await _context.FriendInvitations.FindAsync(id);
        if (invitation == null || invitation.Status != InvitationStatus.Pending)
            return NotFound("Invitation not found or already handled.");

        invitation.Status = InvitationStatus.Declined;
        await _context.SaveChangesAsync();

        return Ok("Friend request declined.");
    }
    
    // GET: Hent status mellom to brukere
    [HttpGet("between/{userAId}/{userBId}")]
    public async Task<IActionResult> GetStatusBetweenUsers(int userAId, int userBId)
    {
        var invitation = await _context.FriendInvitations
            .Where(x =>
                (x.SenderId == userAId && x.ReceiverId == userBId) ||
                (x.SenderId == userBId && x.ReceiverId == userAId))
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
