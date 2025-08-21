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
public class FriendInvitationsController : BaseController
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
        var userId = GetUserId();
        
        if (userId == null)
        {
            return Unauthorized("User not authenticated.");
        }
        
        // Valider at brukeren ikke sender til seg selv
        if (userId == dto.ReceiverId)
        {
            return BadRequest("You cannot send a friend request to yourself.");
        }
        
        var blockingCheck = await CheckBlockingStatus(userId.Value, dto.ReceiverId, "send");
        if (blockingCheck != null)
        {
            return blockingCheck;
        }

        // Sjekk om de allerede er venner
        var existingFriendship = await _context.Friends
            .FirstOrDefaultAsync(f => 
                (f.UserId == userId.Value && f.FriendId == dto.ReceiverId) ||
                (f.UserId == dto.ReceiverId && f.FriendId == userId.Value));

        if (existingFriendship != null)
        {
            return BadRequest("You are already friends with this user.");
        }

        // HENT EKSISTERENDE FORESPØRSEL (BEGGE RETNINGER)
        var existingInvitation = await _context.FriendInvitations
            .FirstOrDefaultAsync(x => 
                (x.SenderId == userId.Value && x.ReceiverId == dto.ReceiverId) ||
                (x.SenderId == dto.ReceiverId && x.ReceiverId == userId.Value));

        // ANALYSER SCENARIOER
        if (existingInvitation != null)
        {
            // Scenario 1: Vi har allerede sendt en pending forespørsel
            if (existingInvitation.SenderId == userId.Value && existingInvitation.Status == InvitationStatus.Pending)
            {
                return BadRequest("You have already sent a friend request to this user.");
            }
            
            // Scenario 2: Vi har tidligere fått avslag, kan ikke sende på nytt
            if (existingInvitation.SenderId == userId.Value && existingInvitation.Status == InvitationStatus.Declined)
            {
                return BadRequest("You have already sent a friend request to this user.");
            }
            
            // Scenario 3: Mottakeren har en pending forespørsel til oss - AUTO-ACCEPT
            if (existingInvitation.SenderId == dto.ReceiverId && existingInvitation.Status == InvitationStatus.Pending)
            {
                return await HandleAutoAccept(existingInvitation, "Friend request automatically accepted - you accepted their pending request.");
            }
            
            // Scenario 4: Vi declined tidligere, men sender nå (mutual interest) - AUTO-ACCEPT
            if (existingInvitation.SenderId == dto.ReceiverId && existingInvitation.Status == InvitationStatus.Declined)
            {
                return await HandleAutoAccept(null, "Friend request sent and automatically accepted - mutual interest detected.", userId.Value, dto.ReceiverId);
            }
        }

        // NORMAL SCENARIO - Send vanlig forespørsel
        return await SendNormalInvitation(userId.Value, dto.ReceiverId);
    }

    private async Task<IActionResult> HandleAutoAccept(FriendInvitation existingInvitation, string reason, int? senderId = null, int? receiverId = null)
    {
        try
        {
            FriendInvitation acceptedInvitation;
            int originalSenderId, originalReceiverId; // 🆕 Track original sender/receiver
            
            if (existingInvitation != null)
            {
                // Oppdater eksisterende pending invitation
                existingInvitation.Status = InvitationStatus.Accepted;
                acceptedInvitation = existingInvitation;
                originalSenderId = existingInvitation.ReceiverId; // Den som svarer
                originalReceiverId = existingInvitation.SenderId; // Den opprinnelige senderen
            }
            else
            {
                // Opprett ny accepted invitation
                acceptedInvitation = new FriendInvitation
                {
                    SenderId = senderId.Value,
                    ReceiverId = receiverId.Value,
                    Status = InvitationStatus.Accepted,
                    SentAt = DateTime.UtcNow
                };
                _context.FriendInvitations.Add(acceptedInvitation);
                originalSenderId = senderId.Value;
                originalReceiverId = receiverId.Value;
            }

            // Opprett vennskap
            var friendship = new Friends
            {
                UserId = originalSenderId,
                FriendId = originalReceiverId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Friends.Add(friendship);

            // Håndter eksisterende meldingsforespørsel
            var conversationId = await HandleExistingMessageRequest(originalSenderId, originalReceiverId);

            await _context.SaveChangesAsync();

            // 🆕 Hent brukerdata FØR sync events (med oppdatert relationship status)
            var friendUserSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                _context, originalReceiverId, originalSenderId);

            // Send notifikasjon og sync events (kun én gang!)
            await SendNotificationAndSyncEvents(acceptedInvitation, conversationId, originalSenderId, originalReceiverId, isAutoAccept: true);

            return Ok(new { 
                message = reason,
                autoAccepted = true,
                conversationId = conversationId,
                friendUser = friendUserSummary // Den nye vennen
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error while handling auto-accept friend invitation. SenderId: {SenderId}, ReceiverId: {ReceiverId}", senderId, receiverId);
            return StatusCode(500, "An error occurred on the server.");
        }
    }

    private async Task<IActionResult> SendNormalInvitation(int senderId, int receiverId)
    {
        var invitation = new FriendInvitation
        {
            SenderId = senderId,
            ReceiverId = receiverId,
            Status = InvitationStatus.Pending,
            SentAt = DateTime.UtcNow
        };

        try
        {
            _context.FriendInvitations.Add(invitation);
            await _context.SaveChangesAsync();

            // Send notifikasjon og sync events (samme logikk som auto-accept, men for pending)
            await SendNotificationAndSyncEvents(invitation, null, senderId, receiverId, isAutoAccept: false);

            return Ok(new { message = "Friend request sent." });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error while handling friend invitation send to {ReceiverId} by {SenderId}", receiverId, senderId);
            return StatusCode(500, "An error occurred on the server.");
        }
    }

    private async Task<int?> HandleExistingMessageRequest(int userId, int receiverId)
    {
        var existingMessageRequest = await _context.MessageRequests
            .Include(mr => mr.Conversation)
            .FirstOrDefaultAsync(r => 
                ((r.SenderId == userId && r.ReceiverId == receiverId) ||
                 (r.SenderId == receiverId && r.ReceiverId == userId)) &&
                !r.IsAccepted);

        if (existingMessageRequest != null)
        {
            existingMessageRequest.IsAccepted = true;
            existingMessageRequest.IsRejected = false;
            
            if (existingMessageRequest.Conversation != null)
            {
                existingMessageRequest.Conversation.IsApproved = true;
            }
            
            if (existingMessageRequest.ConversationId.HasValue)
            {
                await _context.AddCanSendAsync(userId, existingMessageRequest.ConversationId.Value, _msgCache, CanSendReason.Friendship);
                await _context.AddCanSendAsync(receiverId, existingMessageRequest.ConversationId.Value, _msgCache, CanSendReason.Friendship);
            }
            
            return existingMessageRequest.ConversationId;
        }
        
        return null;
    }

    private async Task SendNotificationAndSyncEvents(FriendInvitation invitation, int? conversationId, int senderId, int receiverId, bool isAutoAccept)
    {
        if (isAutoAccept)
        {
            // For auto-accept: Send "accepted" notifikasjon
            await _notificationService.CreateNotificationAsync(
                recipientUserId: receiverId,
                relatedUserId: senderId,
                type: NotificationEntityType.FriendInvAccepted,
                friendInvitationId: invitation.Id,
                conversationId: conversationId
            );

            // Send FRIEND_ADDED sync events til begge brukere
            _taskQueue.QueueAsync(async () => 
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try 
                {
                    var senderSummaryForReceiver = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                        context, senderId, receiverId);
                        
                    var receiverSummaryForSender = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                        context, receiverId, senderId);

                    if (senderSummaryForReceiver != null && receiverSummaryForSender != null)
                    {
                        // Event til mottakeren - legg til ny venn (senderen)
                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.FRIEND_ADDED,
                            eventData: new { 
                                friendUser = senderSummaryForReceiver,
                                conversationId = conversationId
                            },
                            singleUserId: receiverId,
                            source: "API",
                            relatedEntityId: senderId,
                            relatedEntityType: "Friends"
                        );

                        // Event til senderen - legg til ny venn (mottakeren)  
                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.FRIEND_ADDED,
                            eventData: new { 
                                friendUser = receiverSummaryForSender,
                                conversationId = conversationId
                            },
                            singleUserId: senderId,
                            source: "API",
                            relatedEntityId: receiverId,
                            relatedEntityType: "Friends"
                        );
                    }
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to create sync events for auto-accepted friend request. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                        invitation.Id, senderId, receiverId);
                }
            });
        }
        else
        {
            // For normal request: Send "invitation received" notifikasjon
            await _notificationService.CreateNotificationAsync(
                recipientUserId: receiverId,
                relatedUserId: senderId,
                type: NotificationEntityType.FriendInvitation,
                friendInvitationId: invitation.Id
            );
            
            // Send FRIEND_REQUEST_RECEIVED sync event til mottakeren
            _taskQueue.QueueAsync(async () => 
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try 
                {
                    var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                        context, senderId, receiverId);
                    
                    if (senderSummary != null)
                    {
                        var invitationDto = invitation.ToFriendInvitationDto(senderSummary);

                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.FRIEND_REQUEST_RECEIVED,
                            eventData: invitationDto,
                            singleUserId: receiverId,
                            source: "API",
                            relatedEntityId: invitation.Id,
                            relatedEntityType: "FriendInvitation"
                        );
                    }
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to create sync event for friend request. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                        invitation.Id, senderId, receiverId);
                }
            });
        }
    }
    
    private async Task<IActionResult> CheckBlockingStatus(int userId, int targetUserId, string context = "send")
    {
        // Sjekk om vi har blokkert dem
        var weBlockedThem = await _context.UserBlocks
            .FirstOrDefaultAsync(b => b.BlockerId == userId && b.BlockedUserId == targetUserId);
    
        if (weBlockedThem != null)
        {
            return context switch
            {
                "send" => BadRequest("You cannot send a friend request to a user you have blocked."),
                "accept" => BadRequest("You cannot accept a friend request from a user you have blocked."),
                _ => BadRequest("You cannot interact with a user you have blocked.")
            };
        }

        // Sjekk om de har blokkert oss
        var theyBlockedUs = await _context.UserBlocks
            .FirstOrDefaultAsync(b => b.BlockerId == targetUserId && b.BlockedUserId == userId);
    
        if (theyBlockedUs != null)
        {
            return context switch
            {
                "send" => BadRequest("This user has a private profile and is not accepting friend requests."),
                "accept" => BadRequest("This friend request is no longer available."),
                _ => BadRequest("This user has a private profile.")
            };
        }

        return null; // Ingen blokkering funnet
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
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        var invitation = await _context.FriendInvitations.FindAsync(id);
        if (invitation == null)
            return NotFound("Invitation not found.");

        // Sjekk om forespørselen allerede er håndtert
        if (invitation.Status == InvitationStatus.Accepted)
            return BadRequest("Friend request has already been accepted.");

        // Kun mottaker av en forespørsel kan godta
        if (invitation.ReceiverId != userId.Value)
            return Forbid("You are not authorized to accept this invitation.");
        
        // Sjekk om de allerede er venner
        var existingFriendship = await _context.Friends
            .FirstOrDefaultAsync(f => 
                (f.UserId == userId.Value && f.FriendId == invitation.SenderId) ||
                (f.UserId == invitation.SenderId && f.FriendId == userId.Value));

        if (existingFriendship != null)
            return BadRequest("You are already friends with this user.");

        var blockingCheck = await CheckBlockingStatus(userId.Value, invitation.SenderId, "accept");
        if (blockingCheck != null)
        {
            return blockingCheck;
        }

        try
        {
            // Oppdater invitation status (aksepter både pending og declined)
            invitation.Status = InvitationStatus.Accepted;

            // Opprett vennskap
            var friendship = new Friends
            {
                UserId = invitation.SenderId,
                FriendId = invitation.ReceiverId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Friends.Add(friendship);

            // Håndter eksisterende meldingsforespørsel
            var conversationId = await HandleExistingMessageRequest(invitation.SenderId, invitation.ReceiverId);

            await _context.SaveChangesAsync();

            // 🆕 Hent brukerdata FØR sync events (med oppdatert relationship status)
            var friendUserSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                _context, invitation.SenderId, userId.Value);

            // Send notifikasjon og sync events
            await SendNotificationAndSyncEvents(invitation, conversationId, userId.Value, invitation.SenderId, isAutoAccept: true);

            return Ok(new { 
                message = "Friend request accepted.",
                conversationId = conversationId,
                friendUser = friendUserSummary // Den nye vennen
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error while accepting friend invitation. InvitationId: {InvitationId}, SenderId: {SenderId}, ReceiverId: {ReceiverId}", 
                invitation.Id, invitation.SenderId, invitation.ReceiverId);
            return StatusCode(500, "An error occurred on the server.");
        }
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
    
    [HttpGet("rejected")]
    public async Task<IActionResult> GetRejectedFriendInvitations()
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        // Hent avslåtte venneforespørsler hvor innlogget bruker er mottaker
        var rejectedInvitations = await _context.FriendInvitations
            .AsNoTracking()
            .Where(fi => fi.ReceiverId == userId.Value &&  // <-- Endring her
                         fi.Status == InvitationStatus.Declined)
            .OrderByDescending(fi => fi.SentAt)
            .ToListAsync();

        // Bygg FriendInvitationDTO liste med UserSummary for hver sender
        var rejectedInvitationsDTO = new List<FriendInvitationDTO>();

        foreach (var invitation in rejectedInvitations)
        {
            // Hent UserSummary for senderen med relationship info
            var senderSummary = await UserSummaryExtensions.GetUserSummaryWithRelationshipAsync(
                _context, 
                invitation.SenderId, 
                userId.Value);

            if (senderSummary != null)
            {
                rejectedInvitationsDTO.Add(new FriendInvitationDTO
                {
                    Id = invitation.Id,
                    UserSummary = senderSummary,
                    ReceiverId = invitation.ReceiverId,
                    Status = invitation.Status.ToString(),
                    SentAt = invitation.SentAt
                });
            }
        }

        return Ok(rejectedInvitationsDTO);
    }
    
}
