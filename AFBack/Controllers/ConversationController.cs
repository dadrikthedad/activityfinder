using AFBack.Data;
using AFBack.DTOs;
using AFBack.Hubs;
using AFBack.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AFBack.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AFBack.Services;
using System.Security.Claims;


[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConversationsController : BaseController
{
    private readonly ConversationService _conversationService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IMessageService _messageService;
    private readonly ApplicationDbContext _context;

    public ConversationsController(ConversationService conversationService, IHubContext<ChatHub> hubContext, IMessageService messageService, ApplicationDbContext context)
    {
        _conversationService = conversationService;
        _hubContext = hubContext;
        _messageService = messageService;
        _context = context;
    }
    // Endepunkt for å hente alle samtalene til en bruker. Funker i frontend i /chat
    [HttpGet("my-conversations")]
    public async Task<IActionResult> GetMyConversations([FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");
        
        var conversationResults = await _conversationService.GetUserConversationsSortedAsync(userId.Value);

        var totalCount = conversationResults.Count;

        var paged = conversationResults
            .Skip(skip)
            .Take(take)
            .Select(c => new ConversationDTO
            {
                Id = c.Conversation.Id,
                GroupName = c.Conversation.GroupName,
                IsGroup = c.Conversation.IsGroup,
                GroupImageUrl = c.Conversation.GroupImageUrl,
                LastMessageSentAt = c.Conversation.LastMessageSentAt,
                Participants = c.Conversation.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl,
                    GroupRequestStatus = !c.Conversation.IsGroup ? null :
                        p.User.Id == c.Conversation.CreatorId ? GroupRequestStatus.Creator :  // ✅ Bruk Creator enum
                        c.GroupRequestLookup.TryGetValue(p.User.Id, out var status) ? status : 
                        null  // ✅ null = ingen GroupRequest finnes (ikke invitert ennå)
                }).ToList(),
                IsPendingApproval = c.IsPendingApproval 
            })
            .ToList();

        return Ok(new PagedConversationsResponseDTO
        {
            TotalCount = totalCount,
            Conversations = paged
        });
    }

    // Endepunkt for å hente meldinger utifra ConversationId, med skip og take til å hente kun noen omgangen. Funker i frontend i /chat
    [HttpGet("conversation/{conversationId}")]
    public async Task<IActionResult> GetMessagesForConversation(int conversationId, [FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized(new { message = "Ugyldig eller manglende bruker-ID i token." });

        var messages = await _messageService.GetMessagesForConversationAsync(conversationId, userId.Value, skip, take);
        return Ok(messages);
    }
    
    // Hente kun en samtale
    [HttpGet("{conversationId}")]
    public async Task<IActionResult> GetConversationById(int conversationId)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        var conversation = await _context.Conversations
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .ThenInclude(u => u.Profile)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            return NotFound("Samtalen finnes ikke.");

        if (!conversation.Participants.Any(p => p.UserId == userId))
            return Forbid("Du har ikke tilgang til denne samtalen.");

        var lastMessage = conversation.Messages
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefault();
        
        bool isApproved;
        bool isPending;
        
        // Hent GroupRequests for denne samtalen hvis det er en gruppe
        Dictionary<int, GroupRequestStatus> groupRequestLookup = new();
        if (conversation.IsGroup)
        {
            groupRequestLookup = await _context.GroupRequests
                .Where(gr => gr.ConversationId == conversationId)
                .ToDictionaryAsync(gr => gr.ReceiverId, gr => gr.Status);
        }

        if (conversation.IsGroup)
        {
            bool isCreator = conversation.CreatorId == userId;
    
            if (isCreator)
            {
                isApproved = true;
                isPending = false;
            }
            else
            {
                // Bruk groupRequestLookup i stedet for ny database-query
                if (groupRequestLookup.TryGetValue(userId.Value, out var myStatus))
                {
                    isApproved = myStatus == GroupRequestStatus.Approved;
                    isPending = myStatus == GroupRequestStatus.Pending;
                }
                else
                {
                    isApproved = false;
                    isPending = true; // Ingen request funnet = pending
                }
            }
        }
        else
        {
            // ✅ 1-TIL-1 LOGIKK (eksisterende)
            var otherUserId = conversation.Participants.FirstOrDefault(p => p.UserId != userId)?.UserId;

            if (otherUserId == null)
            {
                // Sikkerhet: Bør ikke skje, men håndter det
                isApproved = false;
                isPending = false;
            }
            else
            {
                var isFriend = await _context.Friends.AnyAsync(f =>
                    (f.UserId == userId && f.FriendId == otherUserId) ||
                    (f.UserId == otherUserId && f.FriendId == userId));

                var messageRequest = await _context.MessageRequests
                    .FirstOrDefaultAsync(r =>
                        r.ConversationId == conversationId &&
                        ((r.SenderId == userId && r.ReceiverId == otherUserId) ||
                         (r.SenderId == otherUserId && r.ReceiverId == userId)));

                isApproved = conversation.IsApproved || isFriend || messageRequest?.IsAccepted == true;
            
                isPending = !isApproved &&
                            messageRequest != null &&
                            messageRequest.SenderId == userId &&
                            !messageRequest.IsAccepted &&
                            !messageRequest.IsRejected;
            }
        }

        var dto = new ConversationDTO
        {
            Id = conversation.Id,
            GroupName = conversation.GroupName,
            IsGroup = conversation.IsGroup,
            GroupImageUrl = conversation.GroupImageUrl,
            LastMessageSentAt = lastMessage?.SentAt,
            Participants = conversation.Participants.Select(p => new UserSummaryDTO
            {
                Id = p.User.Id,
                FullName = p.User.FullName,
                ProfileImageUrl = p.User.Profile?.ProfileImageUrl,
                GroupRequestStatus = !conversation.IsGroup ? null :
                    p.User.Id == conversation.CreatorId ? GroupRequestStatus.Creator :  // ✅ Bruk Creator enum
                    groupRequestLookup.TryGetValue(p.User.Id, out var status) ? status : 
                    null
            }).ToList(),
            IsApproved = isApproved, // Tilpass etter behov
            IsPendingApproval = isPending // Tilpass etter behov
        };

        return Ok(dto);
    }
    
    // Søke i samtaler
    [HttpGet("search-conversations")]
    public async Task<IActionResult> SearchConversations([FromQuery] string query)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        if (string.IsNullOrWhiteSpace(query))
            return BadRequest("Søketekst må oppgis.");

        var searchQuery = query.Trim().ToLower();

        // Hent samtaler
        var conversationResults = await _conversationService.GetUserConversationsSortedAsync(userId.Value);

        // Filtrer basert på søk
        var filtered = conversationResults
            .Where(c =>
                (!string.IsNullOrEmpty(c.Conversation.GroupName) &&
                 c.Conversation.GroupName.ToLower().Contains(searchQuery)) ||
                c.Conversation.Participants.Any(p =>
                    p.User.FullName.ToLower().Contains(searchQuery)))
            .Select(c => new ConversationDTO
            {
                Id = c.Conversation.Id,
                GroupName = c.Conversation.GroupName,
                IsGroup = c.Conversation.IsGroup,
                GroupImageUrl = c.Conversation.GroupImageUrl,
                LastMessageSentAt = c.Conversation.LastMessageSentAt,
                Participants = c.Conversation.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList(),
                IsPendingApproval = c.IsPendingApproval 
            })
            .ToList();

        return Ok(filtered);
    }
    
    // totalt uleste meldinger pr bruker
    [HttpGet("unread-summary")]
    public async Task<IActionResult> GetUnreadSummary()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized("Ugyldig bruker-ID.");

        var summary = await _conversationService.GetUnreadSummaryAsync(userId);
        return Ok(summary);
    }
    
    // Går inn på en samtale og markerer meldingen som lest
    [HttpPost("{conversationId}/mark-read")]
    public async Task<IActionResult> MarkConversationAsRead(int conversationId)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized("Ugyldig bruker-ID.");

        await _conversationService.MarkConversationAsReadAsync(userId, conversationId);
        return Ok(new { message = "Samtalen er markert som lest." });
    }
    
    [HttpGet("rejected")]
    public async Task<IActionResult> GetRejectedConversations()
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        var rejectedConversations = await _conversationService.GetUserConversationsSortedAsync(userId.Value, includeRejected: true);

        // ✅ Filtrer til samtaler som faktisk er avslått (både 1-til-1 og grupper)
        var filtered = rejectedConversations
            .Where(c => 
                // ✅ Avslåtte 1-til-1 samtaler
                (!c.Conversation.IsGroup && _context.MessageRequests
                    .Any(r => r.ConversationId == c.Conversation.Id &&
                              r.IsRejected &&
                              r.SenderId != userId)) ||
            
                // ✅ Avslåtte gruppesamtaler
                (c.Conversation.IsGroup && _context.GroupRequests
                    .Any(gr => gr.ConversationId == c.Conversation.Id &&
                               gr.ReceiverId == userId &&
                               gr.Status == GroupRequestStatus.Rejected))
            )
            .Select(c => new ConversationDTO
            {
                Id = c.Conversation.Id,
                GroupName = c.Conversation.GroupName,
                GroupImageUrl = c.Conversation.GroupImageUrl,
                IsGroup = c.Conversation.IsGroup,
                LastMessageSentAt = c.Conversation.LastMessageSentAt,
                Participants = c.Conversation.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList(),
                IsPendingApproval = false // Avslåtte samtaler er ikke "pending"
            })
            .ToList();

        return Ok(filtered);
    }
    
}