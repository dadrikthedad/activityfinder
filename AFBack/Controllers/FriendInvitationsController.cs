using System.Security.Claims;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs;
using AFBack.Extensions;
using AFBack.Functions;
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
    private readonly IHubContext<UserHub> _hubContext;
    private readonly SendMessageCache       _msgCache;  
    private readonly FriendService _friendService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<FriendInvitationsController> _logger;
    

    public FriendInvitationsController(ApplicationDbContext context, INotificationService notificationService, IHubContext<UserHub> hubContext,  SendMessageCache msgCache, FriendService friendService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, ILogger<FriendInvitationsController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _hubContext = hubContext;
        _msgCache            = msgCache;
        _friendService = friendService;
        _taskQueue = taskQueue;
        _scopeFactory = scopeFactory;
        _logger = logger;
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
            
            // 🆕 SYNC EVENT - etter SaveChanges
            _taskQueue.QueueAsync(async () => 
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); // Erstatt med din context-klasse

                try 
                {
                    // 🎯 Bruk den nye alt-i-ett metoden
                    var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                        context, 
                        userId, // senderId
                        dto.ReceiverId // currentUserId (mottakerens perspektiv)
                    );
                    
                    if (senderSummary != null)
                    {
                        var invitationDto = invitation.ToFriendInvitationDto(senderSummary);

                        // Sync event til mottakeren om ny vennforespørsel
                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.FRIEND_REQUEST_RECEIVED,
                            eventData: invitationDto, // Send hele DTO-en!
                            singleUserId: dto.ReceiverId,
                            source: "API",
                            relatedEntityId: invitation.Id,
                            relatedEntityType: "FriendInvitation"
                        );
                    }
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to create sync event for friend request. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                        invitation.Id, userId, dto.ReceiverId);
                }
            });

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
            .FirstOrDefaultAsync(i =>
                i.Id == id &&
                (i.ReceiverId == userId || i.SenderId == userId)); // sikkerhet

        if (inv == null) return NotFound();

        // 🎯 Hent sender med relationship data fra current user sitt perspektiv
        var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
            _context,
            inv.SenderId,
            userId // current user's perspective
        );

        if (senderSummary == null) return NotFound("Sender not found");

        var invitationDto = inv.ToFriendInvitationDto(senderSummary);
        return Ok(invitationDto);
    }

    /* ---------- HENT ALLE (eksisterende) ---------- */
    [HttpGet("received")]
    public async Task<ActionResult<List<FriendInvitationDTO>>> GetReceivedInvitations(
        int pageNumber = 1, int pageSize = 10)
    {
        try
        {
            if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                return Unauthorized(new { message = "Invalid user ID in token." });

            // 🎯 Bruk FriendService istedenfor direkte database-logikk
            var (invitations, totalCount) = await _friendService.GetPendingFriendInvitationsAsync(
                userId, pageNumber, pageSize);

            var response = new
            {
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                Data = invitations
            };

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            // FriendService kaster ArgumentException for ugyldig input
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"An error occurred while retrieving invitations. Error: {ex}" });
        }
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
            existingMessageRequest.IsRejected = false;
            conversationId = existingMessageRequest.ConversationId;
            
            // Sett samtalen til godkjent
            if (existingMessageRequest.Conversation != null)
            {
                existingMessageRequest.Conversation.IsApproved = true;
            }
            
            // Legg til i CanSend hvis de allerede har en samtale gående
            if (conversationId.HasValue)
            {
                await _context.AddCanSendAsync(invitation.SenderId, conversationId.Value, _msgCache, CanSendReason.Friendship);
                await _context.AddCanSendAsync(invitation.ReceiverId, conversationId.Value, _msgCache, CanSendReason.Friendship);
            }
            
        }
        
        

        await _context.SaveChangesAsync();
        
        // SYNC EVENTS - etter SaveChanges
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try 
            {
                // 📝 Hent UserSummary for begge brukere fra hver sitt perspektiv
                var senderSummaryForReceiver = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, invitation.SenderId, invitation.ReceiverId);
                    
                var receiverSummaryForSender = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                    context, invitation.ReceiverId, invitation.SenderId);

                if (senderSummaryForReceiver != null && receiverSummaryForSender != null)
                {

                    // Event til mottakeren - legg til ny venn (senderen)
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.FRIEND_ADDED,
                        eventData: new { 
                            friendUser = senderSummaryForReceiver, // 🎯 Den som sendte forespørselen
                            conversationId = conversationId
                        },
                        singleUserId: invitation.ReceiverId,
                        source: "API",
                        relatedEntityId: invitation.SenderId,
                        relatedEntityType: "Friends"
                    );

                    // Event til senderen - legg til ny venn (mottakeren)  
                    await syncService.CreateAndDistributeSyncEventAsync(
                        eventType: SyncEventTypes.FRIEND_ADDED,
                        eventData: new { 
                            friendUser = receiverSummaryForSender, // 🎯 Den som godkjente forespørselen
                            conversationId = conversationId
                        },
                        singleUserId: invitation.SenderId,
                        source: "API",
                        relatedEntityId: invitation.ReceiverId,
                        relatedEntityType: "Friends"
                    );
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to create sync events for friend request acceptance. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                    invitation.Id, invitation.SenderId, invitation.ReceiverId);
            }
        });
        
        await _notificationService.CreateNotificationAsync(
            recipientUserId: invitation.SenderId,
            relatedUserId: invitation.ReceiverId,
            type: NotificationEntityType.FriendInvAccepted,
            friendInvitationId: invitation.Id,
            conversationId: conversationId
        );
        
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
        
        // 🆕 SYNC EVENT - fjern fra pending liste
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();

            try 
            {
                // Event til mottakeren (den som avslo) - fjern fra pending liste
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.FRIEND_REQUEST_DECLINED,
                    eventData: invitation.Id,
                    singleUserId: invitation.ReceiverId, // Kun til den som avslo
                    source: "API",
                    relatedEntityId: invitation.Id,
                    relatedEntityType: "FriendInvitation"
                );
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to create sync event for friend request decline. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                    invitation.Id, invitation.SenderId, invitation.ReceiverId);
            }
        });
        return Ok(new { message = "Friend request declined." });
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
