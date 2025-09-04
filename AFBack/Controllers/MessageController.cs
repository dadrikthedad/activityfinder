using AFBack.DTOs;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using AFBack.Constants;
using AFBack.Data;
using AFBack.DTOs.Crypto;
using AFBack.Extensions;
using AFBack.Models;
using AFBack.Services.Crypto;
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
    private readonly E2EEService _e2eeService;
    private readonly ILogger<MessagesController> _logger;

    public MessagesController(ApplicationDbContext context, IMessageService messageService, IFileService fileService, MessageNotificationService messageNotificationService, IBackgroundTaskQueue taskQueue, IServiceScopeFactory scopeFactory, E2EEService e2eeService, ILogger<MessagesController> logger)
    {
        _context = context;
        _messageService = messageService;
        _taskQueue = taskQueue;
        _fileService = fileService;
        _messageNotificationService = messageNotificationService;
        _scopeFactory = scopeFactory;
        _e2eeService = e2eeService;
        _logger = logger;
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
    public async Task<IActionResult> GetPendingMessageRequests([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var receiverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(receiverIdClaim, out var receiverId))
            return Unauthorized("Ugyldig bruker-ID.");

        // Valider pagination parametere
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 50) pageSize = 10; // Max 50 per side

        try
        {
            var result = await _messageService.GetPendingMessageRequestsAsync(receiverId, page, pageSize);
            return Ok(result);
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
        
        
        MessageResponseDTO? systemMessage = null;
        if (!string.IsNullOrEmpty(user))
        {
            systemMessage = await _messageNotificationService.CreateSystemMessageAsync(conversationId,
            $"{user} has left the conversation"
                );
        }
        
        // 🆕 SYNC EVENTS for Group Request Rejection
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try 
            {
                // 1️⃣ Event til brukeren som avslo - fjern gruppen fra listen
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.CONVERSATION_LEFT,
                    eventData: conversationId,
                    singleUserId: receiverId,
                    source: "API",
                    relatedEntityId: conversationId,
                    relatedEntityType: "GroupRequest"
                );

                // 2️⃣ Event til eksisterende medlemmer om at noen avslo
                var existingMemberIds = await context.ConversationParticipants
                    .Where(cp => cp.ConversationId == conversationId)
                    .Select(cp => cp.UserId)
                    .ToListAsync();

                if (existingMemberIds.Any())
                {
                    // 🆕 Hent oppdatert conversation med remaining members
                    var updatedConversation = await context.Conversations
                        .Include(c => c.Participants)
                            .ThenInclude(p => p.User)
                                .ThenInclude(u => u.Profile)
                        .FirstOrDefaultAsync(c => c.Id == conversationId);

                    if (updatedConversation != null)
                    {
                        // Hent userData for existing members
                        var userData = await SyncEventExtensions.GetUserDataAsync(context, existingMemberIds.ToArray());

                        // Hent group request statuses
                        var groupRequestStatuses = await SyncEventExtensions.GetGroupRequestStatusesAsync(
                            context, conversationId, existingMemberIds.ToArray());

                        // Bygg conversation data
                        var conversationData = updatedConversation.MapConversationToSyncData(
                            receiverId, // Brukeren som avslo
                            userData, 
                            groupRequestStatuses
                        );

                        await syncService.CreateAndDistributeSyncEventAsync(
                            eventType: SyncEventTypes.GROUP_INFO_UPDATED, // 🆕 Endre til GROUP_INFO_UPDATED
                            eventData: new { 
                                conversationData, // 🆕 Send hele conversation object
                                systemMessage     // 🆕 Send systemmelding
                            },
                            targetUserIds: existingMemberIds,
                            source: "API",
                            relatedEntityId: conversationId,
                            relatedEntityType: "Conversation"
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to create sync events for group request rejection: {ex.Message}");
            }
        });
        
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
        
        // 🆕 SYNC EVENT for Message Request Rejection
        _taskQueue.QueueAsync(async () => 
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<SyncService>();

            try 
            {
                await syncService.CreateAndDistributeSyncEventAsync(
                    eventType: SyncEventTypes.CONVERSATION_LEFT,
                    eventData: request.ConversationId,  
                    singleUserId: receiverId, // Kun til den som avslo
                    source: "API",
                    relatedEntityId: request.ConversationId,
                    relatedEntityType: "MessageRequest"
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to create sync event for message request rejection: {ex.Message}");
            }
        });

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
    
    public async Task<IActionResult> SendEncryptedMessage([FromBody] SendEncryptedMessageRequestDTO request)
    {
        try
        {
            // Validation
            if (!request.HasValidContent)
                return BadRequest("Message must have either encrypted text or attachments");

            if (request.KeyInfo?.Any() != true)
                return BadRequest("KeyInfo is required for encrypted messages");

            if (string.IsNullOrEmpty(request.IV))
                return BadRequest("IV is required for encrypted messages");

            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("Invalid user ID in token");

            _logger.LogInformation("Sending encrypted message from user {UserId} to conversation {ConversationId}", 
                userId, request.ConversationId);

            // Now returns EncryptedMessageResponseDTO instead of MessageResponseDTO
            var response = await _messageService.SendEncryptedMessageAsync(userId.Value, request);

            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access attempt for encrypted message from user {UserId}", GetUserId());
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid encrypted message request from user {UserId}: {Error}", GetUserId(), ex.Message);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending encrypted message from user {UserId}", GetUserId());
            return StatusCode(500, "Internal server error");
        }
    }

        /// <summary>
        /// Get encrypted messages for a conversation
        /// </summary>
        [HttpGet("encrypted/conversation/{conversationId:int}")]
        public async Task<IActionResult> GetEncryptedMessages(int conversationId, int skip = 0, int take = 50)
        {
            try
            {
                var userId = GetUserId();
                
                if (userId == null) // Håndter null-tilfellet
                {
                    return Unauthorized("Invalid user ID in token");
                }
                
                _logger.LogInformation("Getting encrypted messages for conversation {ConversationId}, user {UserId}", 
                    conversationId, userId);

                // Validate pagination
                if (skip < 0) skip = 0;
                if (take <= 0 || take > 100) take = 50;

                var messages = await _e2eeService.GetEncryptedMessagesForConversationAsync(
                    conversationId, userId.Value, skip, take);

                return Ok(new
                {
                    messages = messages,
                    pagination = new
                    {
                        skip = skip,
                        take = take,
                        count = messages.Count
                    }
                });
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access to conversation {ConversationId}", conversationId);
                return Forbid();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting encrypted messages for conversation {ConversationId}", conversationId);
                return StatusCode(500, "Internal server error");
            }
        }
        
    
}
    

