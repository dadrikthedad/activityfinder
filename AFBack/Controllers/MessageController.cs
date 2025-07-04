using AFBack.DTOs;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using AFBack.Data;
using AFBack.Models;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : BaseController
{
    private readonly IMessageService _messageService;
    private readonly IFileService _fileService;
    private readonly ApplicationDbContext _context;
    private readonly MessageNotificationService _messageNotificationService;
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly IServiceScopeFactory _scopeFactory;

    public MessagesController(ApplicationDbContext context, IMessageService messageService, IFileService fileService, MessageNotificationService messageNotificationService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _messageService = messageService;
        _taskQueue = taskQueue;
        _fileService = fileService;
        _messageNotificationService = messageNotificationService;
        _scopeFactory = scopeFactory;
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequestDTO request)
    {
        var senderId = GetUserId();
        if (senderId == null)
            return Unauthorized(new { message = "Ugyldig eller manglende bruker-ID i token." });

        if (string.IsNullOrWhiteSpace(request.Text) && 
            (request.Attachments == null || request.Attachments.Count == 0))
        {
            return BadRequest(new { message = "Meldingen må inneholde tekst eller minst ett vedlegg." });
        }

        try
        {
            var response = await _messageService.SendMessageAsync(senderId.Value, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Det oppstod en feil ved sending av melding.", details = ex.Message });
        }
    }
    
    [HttpGet("search")]
    public async Task<IActionResult> SearchMessagesInConversation([FromQuery] int conversationId, [FromQuery] string query, [FromQuery] int skip = 0, [FromQuery] int take = 50)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Brukeren er ikke logget inn." });

        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { message = "Søketeksten kan ikke være tom." });

        try
        {
            var results = await _messageService.SearchMessagesInConversationAsync(conversationId, userId.Value, query, skip, take);
            return Ok(results);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Feil under søk i meldinger.", details = ex.Message });
        }
    }
    
    
    
    // Henter alle meldingsforespørsler
    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingMessageRequests()
    {
        var receiverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(receiverIdClaim, out var receiverId))
            return Unauthorized("Ugyldig bruker-ID.");

        try
        {
            var pendingRequests = await _messageService.GetPendingMessageRequestsAsync(receiverId);
            return Ok(pendingRequests);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Feil ved henting av forespørsler.", details = ex.Message });
        }
    }
    
    // 
    [HttpGet("pending/{conversationId}")]
    public async Task<IActionResult> GetPendingMessageRequestById(int conversationId)
    {
        var receiverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(receiverIdClaim, out var receiverId))
            return Unauthorized("Ugyldig bruker-ID.");

        // ✅ Prøv å hente GroupRequest først
        var groupRequest = await _context.GroupRequests
            .Where(gr => gr.ReceiverId == receiverId && gr.Status == GroupRequestStatus.Pending && gr.ConversationId == conversationId)
            .Include(gr => gr.Sender).ThenInclude(u => u.Profile)
            .Include(gr => gr.Conversation)
                .ThenInclude(c => c.Participants)
                    .ThenInclude(cp => cp.User)
                        .ThenInclude(u => u.Profile)
            .FirstOrDefaultAsync();

        if (groupRequest != null)
        {
            var participants = groupRequest.Conversation?.Participants
                .Select(cp => new UserSummaryDTO
                {
                    Id = cp.UserId,
                    FullName = cp.User.FullName,
                    ProfileImageUrl = cp.User.Profile?.ProfileImageUrl
                })
                .ToList() ?? new List<UserSummaryDTO>();

            return Ok(new MessageRequestDTO
            {
                SenderId = groupRequest.SenderId,
                SenderName = groupRequest.Sender.FullName,
                ProfileImageUrl = groupRequest.Sender.Profile?.ProfileImageUrl,
                RequestedAt = groupRequest.RequestedAt,
                ConversationId = groupRequest.ConversationId,
                GroupName = groupRequest.Conversation?.GroupName,
                IsGroup = true,
                GroupImageUrl = groupRequest.Conversation?.GroupImageUrl,
                LimitReached = false,
                IsPendingApproval = true,
                Participants = participants
            });
        }

        // ✅ Hvis ikke gruppe, prøv å hente vanlig MessageRequest
        var messageRequest = await _context.MessageRequests
            .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && !r.IsRejected && r.ConversationId == conversationId)
            .Include(r => r.Sender).ThenInclude(u => u.Profile)
            .Include(r => r.Conversation)
            .FirstOrDefaultAsync();

        if (messageRequest != null)
        {
            return Ok(new MessageRequestDTO
            {
                SenderId = messageRequest.SenderId,
                SenderName = messageRequest.Sender.FullName,
                ProfileImageUrl = messageRequest.Sender.Profile?.ProfileImageUrl,
                RequestedAt = messageRequest.RequestedAt,
                ConversationId = messageRequest.ConversationId,
                GroupName = messageRequest.Conversation?.GroupName,
                IsGroup = false,
                GroupImageUrl = messageRequest.Conversation?.GroupImageUrl,
                LimitReached = messageRequest.LimitReached,
                IsPendingApproval = messageRequest.Conversation?.IsApproved == false
            });
        }

        return NotFound("Ingen pending samtale eller gruppeforespørsel funnet.");
    }
    
    // Her henter vi meldinger etter vi har godtatt meldingsforespørsel
    [HttpPost("approve-request/{conversationId}")]
    public async Task<IActionResult> ApproveMessageRequest(int conversationId)
    {
        var receiverId = GetUserId();
        if (receiverId == null)
            return Unauthorized();

        try
        {
            await _messageService.ApproveMessageRequestAsync(receiverId.Value, conversationId);
            return Ok(new { message = "Forespørsel godkjent." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
    
    [HttpPost("reject-request")]
    public async Task<IActionResult> RejectRequest([FromBody] RejectRequestDTO request)
    {
        var receiverId = GetUserId();
        if (receiverId == null)
            return Unauthorized();

        try
        {
            // 🆕 Sjekk om det er en GroupRequest
            if (request.ConversationId.HasValue)
            {
                return await RejectGroupRequestAsync(receiverId.Value, request.SenderId, request.ConversationId.Value);
            }
            return await RejectMessageRequestAsync(receiverId.Value, request.SenderId);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // 🆕 Ny metode for å avslå GroupRequest
    private async Task<IActionResult> RejectGroupRequestAsync(int receiverId, int senderId, int conversationId)
    {
        var groupRequest = await _context.GroupRequests
            .FirstOrDefaultAsync(gr => gr.ReceiverId == receiverId && 
                                       gr.SenderId == senderId && 
                                       gr.ConversationId == conversationId &&
                                       gr.Status == GroupRequestStatus.Pending);

        if (groupRequest == null)
            return NotFound(new { message = "Gruppeforespørselen finnes ikke eller er allerede behandlet." });

        // 1️⃣ Endre status til Rejected
        groupRequest.Status = GroupRequestStatus.Rejected;
        groupRequest.IsRead = true;

        // 2️⃣ Fjern bruker fra participants 
        var participant = await _context.ConversationParticipants
            .FirstOrDefaultAsync(cp => cp.ConversationId == conversationId && cp.UserId == receiverId);

        if (participant != null)
        {
            _context.ConversationParticipants.Remove(participant);
        }
        
        var notification = await _context.MessageNotifications
            .FirstOrDefaultAsync(n => n.UserId == receiverId && 
                                      n.ConversationId == conversationId && 
                                      n.Type == NotificationType.GroupRequest &&
                                      !n.IsRead);

        if (notification != null)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // 3️⃣ Lag systemmelding for avslåing (valgfritt)
        var user = await _context.Users
            .Where(u => u.Id == receiverId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync();

        if (!string.IsNullOrEmpty(user))
        {
            await _messageNotificationService.CreateSystemMessageAsync(conversationId,
            $"{user} has left the conversation"
                );
        }
        
        _taskQueue.QueueAsync(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var groupNotifSvc = scope.ServiceProvider.GetRequiredService<GroupNotificationService>();
    
            await groupNotifSvc.CreateGroupEventAsync(
                GroupEventType.MemberLeft,
                conversationId,
                receiverId, // ActorUserId - den som forlot
                new List<int> { receiverId } // AffectedUsers - den som forlot
            );
        });

        return Ok(new { message = "Gruppeforespørsel avslått." });
    }

    // 🔄 Eksisterende metode for MessageRequest (uten endringer)
    private async Task<IActionResult> RejectMessageRequestAsync(int receiverId, int senderId)
    {
        var request = await _context.MessageRequests
            .FirstOrDefaultAsync(r => r.ReceiverId == receiverId && r.SenderId == senderId);

        if (request == null)
            return NotFound(new { message = "Forespørselen finnes ikke." });

        if (request.IsAccepted)
            return BadRequest(new { message = "Forespørselen er allerede godkjent." });

        request.IsRejected = true;
        
        var notification = await _context.MessageNotifications
            .FirstOrDefaultAsync(n => n.UserId == receiverId && 
                                      n.FromUserId == senderId && 
                                      n.Type == NotificationType.MessageRequest &&
                                      !n.IsRead);
        
        if (notification != null)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
        }

        
        await _context.SaveChangesAsync();

        return Ok(new { message = "Forespørsel avslått." });
    }
    
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> SoftDeleteMessage(int messageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var deletedMessage = await _messageService.SoftDeleteMessageAsync(messageId, userId.Value);
            return Ok(deletedMessage); // 🆕 Returner den slettede meldingen
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex) // 🆕 For tidsgrense feil
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "En feil oppstod ved sletting.", details = ex.Message });
        }
    }
    

}