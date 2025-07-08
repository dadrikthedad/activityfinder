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
    private readonly SendMessageCache _msgCache;

    public ConversationsController(ConversationService conversationService, IHubContext<ChatHub> hubContext, IMessageService messageService, ApplicationDbContext context, SendMessageCache msgCache)
    {
        _conversationService = conversationService;
        _hubContext = hubContext;
        _messageService = messageService;
        _context = context;
        _msgCache = msgCache;
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

        // 🚀 LETT OPTIMALISERING: Sjekk CanSend først for rask approval-status
        bool canSend = await _msgCache.CanUserSendAsync(userId.Value, conversationId);

        var conversation = await _context.Conversations
            .AsNoTracking() // 🆕 ReadOnly siden vi ikke endrer data
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .ThenInclude(u => u.Profile)
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            return NotFound("Samtalen finnes ikke.");
        
        var userParticipant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        if (userParticipant == null)
            return Forbid("Du har ikke tilgang til denne samtalen.");
        
        if (userParticipant.HasDeleted)
            return BadRequest("Du har slettet denne samtalen. Gjenopprett den for å få tilgang.");

        var lastMessage = conversation.Messages
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefault();
        
        bool isApproved;
        bool isPending;
        bool isCreator = conversation.CreatorId == userId;
        
        // 🎯 FORENKLET LOGIKK med CanSend
        if (canSend || isCreator)
        {
            // ✅ Bruker kan sende = fullstendig godkjent
            isApproved = true;
            isPending = false;
        }
        else
        {
            // 🔍 Fallback: Sjekk pending status
            if (conversation.IsGroup)
            {
                // For grupper: sjekk GroupRequest status
                var myGroupRequest = await _context.GroupRequests
                    .AsNoTracking()
                    .FirstOrDefaultAsync(gr => gr.ConversationId == conversationId && gr.ReceiverId == userId);
                
                isApproved = false; // Ikke i CanSend = ikke godkjent
                isPending = myGroupRequest?.Status == GroupRequestStatus.Pending;
            }
            else
            {
                // For 1-1: sjekk MessageRequest status
                var otherUserId = conversation.Participants.FirstOrDefault(p => p.UserId != userId)?.UserId;
                
                if (otherUserId.HasValue)
                {
                    var messageRequest = await _context.MessageRequests
                        .AsNoTracking()
                        .FirstOrDefaultAsync(r =>
                            r.ConversationId == conversationId &&
                            ((r.SenderId == userId && r.ReceiverId == otherUserId) ||
                             (r.SenderId == otherUserId && r.ReceiverId == userId)));

                    isApproved = false; // Ikke i CanSend = ikke godkjent
                    isPending = messageRequest?.SenderId == userId && 
                               !messageRequest.IsAccepted && 
                               !messageRequest.IsRejected;
                }
                else
                {
                    isApproved = false;
                    isPending = false;
                }
            }
        }
        
        // Hent GroupRequests for participants display (kun hvis gruppe)
        Dictionary<int, GroupRequestStatus> groupRequestLookup = new();
        if (conversation.IsGroup)
        {
            groupRequestLookup = await _context.GroupRequests
                .AsNoTracking()
                .Where(gr => gr.ConversationId == conversationId)
                .ToDictionaryAsync(gr => gr.ReceiverId, gr => gr.Status);
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
                    p.User.Id == conversation.CreatorId ? GroupRequestStatus.Creator :
                    groupRequestLookup.TryGetValue(p.User.Id, out var status) ? status : 
                    null
            }).ToList(),
            IsApproved = isApproved,
            IsPendingApproval = isPending
        };

        return Ok(dto);
    }
    
   [HttpGet("search-conversations")]
    public async Task<IActionResult> SearchConversationsOptimized([FromQuery] string query)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        if (string.IsNullOrWhiteSpace(query))
            return BadRequest("Søketekst må oppgis.");

        var searchQuery = query.Trim();

        // Hent tillatte samtaler
        var canSendConversationIds = await _msgCache.GetUserCanSendConversationsAsync(userId.Value);

        var pendingMessageRequestConvIds = await _context.MessageRequests
            .AsNoTracking()
            .Where(r => r.SenderId == userId.Value && !r.IsAccepted && !r.IsRejected && r.ConversationId.HasValue)
            .Select(r => r.ConversationId!.Value)
            .ToListAsync();

        var allowedConversationIds = canSendConversationIds
            .Concat(pendingMessageRequestConvIds)
            .ToHashSet();

        // 🎯 PROJECTION: Direkte til DTO i database
        var conversations = await _context.Conversations
            .AsNoTracking()
            .Where(c => c.Participants.Any(p => p.UserId == userId.Value && !p.HasDeleted) &&
                       (allowedConversationIds.Contains(c.Id) || c.CreatorId == userId.Value) &&
                       (
                           (!string.IsNullOrEmpty(c.GroupName) && EF.Functions.ILike(c.GroupName, $"%{searchQuery}%")) ||
                           c.Participants.Any(p => EF.Functions.ILike(p.User.FullName, $"%{searchQuery}%"))
                       ))
            .OrderByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue)
            .Select(c => new ConversationDTO
            {
                Id = c.Id,
                GroupName = c.GroupName,
                IsGroup = c.IsGroup,
                GroupImageUrl = c.GroupImageUrl,
                LastMessageSentAt = c.LastMessageSentAt,
                Participants = c.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile != null ? p.User.Profile.ProfileImageUrl : null,
                    GroupRequestStatus = !c.IsGroup ? null :
                        p.User.Id == c.CreatorId ? GroupRequestStatus.Creator : null
                }).ToList(),
                IsPendingApproval = !c.IsApproved && !c.IsGroup && c.CreatorId == userId.Value
            })
            .ToListAsync();
        
        var sortedConversations = conversations
            .OrderBy(c => c.IsGroup ? 1 : 0)  // 1-1 samtaler først
            .ThenBy(c => {
                // Prioriter eksakte navn-match
                if (!c.IsGroup)
                {
                    var exactMatch = c.Participants.Any(p => 
                        p.FullName.Equals(searchQuery, StringComparison.OrdinalIgnoreCase));
                    return exactMatch ? 0 : 1;
                }
                else
                {
                    var exactMatch = c.GroupName?.Equals(searchQuery, StringComparison.OrdinalIgnoreCase) == true;
                    return exactMatch ? 0 : 1;
                }
            })
            .ThenByDescending(c => c.LastMessageSentAt ?? DateTime.MinValue)  // Så etter aktivitet
            .ToList();

        return Ok(sortedConversations);
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
    
    [HttpDelete("{conversationId}/delete")]
    public async Task<IActionResult> DeleteConversation(int conversationId)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        try
        {
            await _conversationService.DeleteConversationForUserAsync(conversationId, userId.Value);
            return Ok(new { message = "Samtalen har blitt slettet." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    
    [HttpPost("{conversationId}/restore")]
    public async Task<IActionResult> RestoreConversation(int conversationId)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        try
        {
            await _conversationService.RestoreConversationForUserAsync(conversationId, userId.Value);
            return Ok(new { message = "Samtalen har blitt gjenopprettet." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    
    [HttpGet("deleted")]
    public async Task<IActionResult> GetDeletedConversations()
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        // Hent samtaler hvor brukeren har slettet (HasDeleted = true)
        var deletedConversations = await _context.Conversations
            .AsNoTracking()
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .ThenInclude(u => u.Profile)
            .Where(c => 
                // Kun 1-1 samtaler (gruppesamtaler kan ikke slettes på denne måten)
                !c.IsGroup &&
                // Brukeren må være participant og ha slettet
                c.Participants.Any(p => p.UserId == userId && p.HasDeleted))
            .ToListAsync(); // 🔧 Hent data først, sorter i minnet

        // 🔧 Sorter i minnet etter DeletedAt
        var sortedConversations = deletedConversations
            .OrderByDescending(c => c.Participants
                .Where(p => p.UserId == userId)
                .FirstOrDefault()?.DeletedAt ?? DateTime.MinValue)
            .Select(c => new ConversationDTO
            {
                Id = c.Id,
                GroupName = c.GroupName,
                GroupImageUrl = c.GroupImageUrl,
                IsGroup = c.IsGroup,
                LastMessageSentAt = c.LastMessageSentAt,
                Participants = c.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList(),
                IsPendingApproval = false
            })
            .ToList();

        return Ok(sortedConversations);
    }
    
}