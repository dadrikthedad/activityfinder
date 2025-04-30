using AFBack.DTOs;
using AFBack.Hubs;
using Microsoft.AspNetCore.SignalR;

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

    public ConversationsController(ConversationService conversationService, IHubContext<ChatHub> hubContext, IMessageService messageService)
    {
        _conversationService = conversationService;
        _hubContext = hubContext;
        _messageService = messageService;
    }
    // Endepunkt for å hente alle samtalene til en bruker
    [HttpGet("my-conversations")]
    public async Task<IActionResult> GetMyConversations([FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        var conversations = await _conversationService.GetUserConversationsSortedAsync(userId.Value);

        var totalCount = conversations.Count;

        var paged = conversations
            .Skip(skip)
            .Take(take)
            .Select(c => new ConversationDTO
            {
                Id = c.Id,
                GroupName = c.GroupName,
                IsGroup = c.IsGroup,
                LastMessageSentAt = c.Messages.OrderByDescending(m => m.SentAt).FirstOrDefault()?.SentAt,
                Participants = c.Participants.Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList()
            })
            .ToList();

        return Ok(new PagedConversationsResponseDTO
        {
            TotalCount = totalCount,
            Conversations = paged
        });
    }
    
    // Endepunkt for å hente meldinger utifra ConversationId, med skip og take til å hente kun noen omgangen
    [HttpGet("conversation/{conversationId}")]
    public async Task<IActionResult> GetMessagesForConversation(int conversationId, [FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var senderId = GetUserId();
        if (senderId == null)
            return Unauthorized(new { message = "Ugyldig eller manglende bruker-ID i token." });

        var messages = await _messageService.GetMessagesForConversationAsync(conversationId, skip, take);
        return Ok(messages);
    }
    
    // Opprette en gruppe
    [HttpPost("group")]
    public async Task<IActionResult> CreateGroup([FromBody] string groupName)
    {
        if (string.IsNullOrWhiteSpace(groupName))
            return BadRequest("Gruppenavn kan ikke være tomt.");

        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig eller manglende bruker-ID i token.");

        try
        {
            // Opprett gruppen
            var group = await _conversationService.CreateGroupAsync(groupName);

            // Legg til oppretter som deltaker
            await _conversationService.InviteParticipantAsync(group.Id, userId.Value, userId.Value, autoAccept: true);

            return Ok(new
            {
                group.Id,
                group.GroupName,
                group.IsGroup
            });
        }
        catch (Exception ex)
        {
            return BadRequest($"Kunne ikke opprette gruppe: {ex.Message}");
        }
    }
    
    // Legge til medlem i gruppen
    [HttpPost("{conversationId}/participants")]
    public async Task<IActionResult> AddUserToGroup(int conversationId, [FromBody] int userId)
    {
        var inviterId = GetUserId();
        if (inviterId == null)
            return Unauthorized("Ugyldig eller manglende inviter-ID i token.");

        if (userId <= 0)
            return BadRequest("Ugyldig bruker-ID oppgitt.");

        try
        {
            await _conversationService.InviteParticipantAsync(conversationId, inviterId.Value, userId);
            return Ok(new { message = $"Invitasjon sendt til bruker med ID {userId} for gruppe {conversationId}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Kunne ikke sende invitasjon.", details = ex.Message });
        }
    }

    
    // Fjerne en bruker fra gruppen
    [HttpDelete("{conversationId}/participants/{userId}")]
    public async Task<IActionResult> RemoveUserFromGroup(int conversationId, int userId)
    {
        if (userId <= 0 || conversationId <= 0)
            return BadRequest("Ugyldig bruker- eller gruppe-ID.");

        try
        {
            await _conversationService.RemoveParticipantAsync(conversationId, userId);

            var group = await _conversationService.GetConversationByIdAsync(conversationId);
            if (group?.GroupName != null)
            {
                await _hubContext.Clients.User(userId.ToString()).SendAsync("LeaveGroup", group.GroupName);
            }

            return Ok(new { message = $"Bruker med ID {userId} er fjernet fra gruppe {conversationId}." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Kunne ikke fjerne bruker fra gruppen.", details = ex.Message });
        }
    }
    
    // Henter mine grupper
    [HttpGet("mine")]
    public async Task<IActionResult> GetMyGroups()
    {
        var userId = GetUserId();
        if (userId == null)
            return Unauthorized("Ugyldig bruker-ID.");

        var groups = await _conversationService.GetUserConversationsAsync(userId.Value, isGroup: true);

        var result = groups.Select(c => new GroupConversationDTO
        {
            Id = c.Id,
            GroupName = c.GroupName,
            Participants = c.Participants
                .Where(p => p.User != null)
                .Select(p => new UserSummaryDTO
                {
                    Id = p.User.Id,
                    FullName = p.User.FullName,
                    ProfileImageUrl = p.User.Profile?.ProfileImageUrl
                }).ToList()
        });

        return Ok(result);
    }
    
    // Sletter en gruppe
    [HttpDelete("{conversationId}")]
    public async Task<IActionResult> DeleteGroup(int conversationId)
    {
        try
        {
            await _conversationService.DeleteGroupAsync(conversationId);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Kunne ikke slette gruppe: {ex.Message}");
        }
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
    
    // Godta venneforespørsel
    
}