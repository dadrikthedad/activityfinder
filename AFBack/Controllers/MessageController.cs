using AFBack.DTOs;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using AFBack.Data;
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

    public MessagesController(ApplicationDbContext context, IMessageService messageService, IFileService fileService)
    {
        _context = context;
        _messageService = messageService;
        _fileService = fileService;
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
    
    
    
    // Endepunkt for å laste opp filer til en melding
    [HttpPost("upload-attachment")]
    public async Task<IActionResult> UploadAttachment([FromForm] UploadAttachmentRequest request)
    {
        
        var file = request.File;

        if (file == null || file.Length == 0)
            return BadRequest("Filen kan ikke være tom.");

        try
        {
            var fileUrl = await _fileService.UploadFileAsync(file, "messageattachments"); // Bruker container "messageattachments"
            return Ok(new { fileUrl });
        }
        catch (Exception ex)
        {
            // Eventuelt logge feilen her med Serilog hvis du ønsker
            return StatusCode(500, $"Opplasting feilet: {ex.Message}");
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
    
    // For å hente samtalen til en MessageRequest selv
    [HttpGet("pending/{conversationId}")]
    public async Task<IActionResult> GetPendingMessageRequestById(int conversationId)
    {
        var receiverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(receiverIdClaim, out var receiverId))
            return Unauthorized("Ugyldig bruker-ID.");

        var request = await _context.MessageRequests
            .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && r.ConversationId == conversationId)
            .Include(r => r.Sender).ThenInclude(u => u.Profile)
            .Include(r => r.Conversation)
            .FirstOrDefaultAsync();

        if (request == null)
            return NotFound();

        var dto = new MessageRequestDTO
        {
            SenderId = request.SenderId,
            SenderName = request.Sender.FullName,
            ProfileImageUrl = request.Sender.Profile?.ProfileImageUrl,
            RequestedAt = request.RequestedAt,
            ConversationId = request.ConversationId,
            GroupName = request.Conversation?.GroupName,
            IsGroup = request.Conversation?.IsGroup ?? false,
            LimitReached = request.LimitReached,
            IsPendingApproval = request.Conversation?.IsApproved == false
        };

        return Ok(dto);
    }
    
    // Her henter vi meldinger etter vi har godtatt meldingsforespørsel
    [HttpPost("approve-request")]
    public async Task<IActionResult> ApproveMessageRequest([FromBody] int senderId)
    {
        var receiverId = GetUserId();
        if (receiverId == null)
            return Unauthorized();

        try
        {
            await _messageService.ApproveMessageRequestAsync(receiverId.Value, senderId);
            return Ok(new { message = "Forespørsel godkjent og meldinger levert." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
    
    // Avslå venneforespørsel
    [HttpPost("reject-request")]
    public async Task<IActionResult> RejectMessageRequest([FromBody] int senderId)
    {
        var receiverId = GetUserId();
        if (receiverId == null)
            return Unauthorized();

        try
        {
            var request = await _context.MessageRequests
                .FirstOrDefaultAsync(r => r.ReceiverId == receiverId && r.SenderId == senderId);

            if (request == null)
                return NotFound(new { message = "Forespørselen finnes ikke." });

            if (request.IsAccepted)
                return BadRequest(new { message = "Forespørselen er allerede godkjent." });

            request.IsRejected = true;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Forespørsel avslått." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
    
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> SoftDeleteMessage(int messageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _messageService.SoftDeleteMessageAsync(messageId, userId.Value);
            return Ok(new { message = "Melding er merket som slettet." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "En feil oppstod ved sletting.", details = ex.Message });
        }
    }
    
    // // Akseptere en gruppeinvitasjon
    // [HttpPost("accept-invite")]
    // public async Task<IActionResult> AcceptGroupInvite([FromBody] int conversationId)
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized("Ugyldig eller manglende bruker-ID i token.");
    //
    //     try
    //     {
    //         await _messageService.AcceptGroupInviteAsync(userId.Value, conversationId);
    //         return Ok(new { message = "Du er nå med i gruppen." });
    //     }
    //     catch (Exception ex)
    //     {
    //         return BadRequest(new { message = ex.Message });
    //     }
    // }
    // // avslå en gruppeinvitasjon
    // [HttpPost("decline-invite")]
    // public async Task<IActionResult> DeclineGroupInvite([FromBody] DeclineGroupInviteRequest request)
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized("Ugyldig eller manglende bruker-ID i token.");
    //
    //     try
    //     {
    //         await _messageService.DeclineGroupInviteAsync(userId.Value, request.ConversationId);
    //         return Ok(new { message = "Gruppeinvitasjonen er avslått." });
    //     }
    //     catch (Exception ex)
    //     {
    //         return BadRequest(new { message = ex.Message });
    //     }
    // }
    //
    //
    // // Hente alle blokkerte brukere
    // [HttpGet("blocked-users")]
    // public async Task<IActionResult> GetBlockedUsers()
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized();
    //
    //     var blockedUsers = await _messageService.GetBlockedUsersAsync(userId.Value);
    //     return Ok(blockedUsers);
    // }
    //
    // // Unblokke en bruker
    // [HttpDelete("unblock/{blockedUserId}")]
    // public async Task<IActionResult> UnblockUser(int blockedUserId)
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized();
    //
    //     var success = await _messageService.UnblockUserAsync(userId.Value, blockedUserId);
    //     if (!success)
    //         return NotFound("Ingen blokkering funnet.");
    //
    //     return Ok(new { message = "Brukeren er ikke lenger blokkert." });
    // }
    //
    // // Blokkere en bruker
    // [HttpPost("block/{blockedUserId}")]
    // public async Task<IActionResult> BlockUser(int blockedUserId)
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized();
    //
    //     try
    //     {
    //         var success = await _messageService.BlockUserAsync(userId.Value, blockedUserId);
    //         if (!success)
    //             return BadRequest("Brukeren er allerede blokkert.");
    //
    //         return Ok(new { message = "Brukeren er nå blokkert." });
    //     }
    //     catch (InvalidOperationException ex)
    //     {
    //         return BadRequest(ex.Message);
    //     }
    // }
    // // Hente alle blokkerte grupper
    // [HttpGet("blocked-groups")]
    // public async Task<IActionResult> GetBlockedGroups()
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized();
    //
    //     var result = await _messageService.GetBlockedGroupsAsync(userId.Value);
    //     return Ok(result);
    // }
    //
    // [HttpPost("unblock-group")]
    // public async Task<IActionResult> UnblockGroup([FromBody] UnblockGroupRequest request)
    // {
    //     var userId = GetUserId();
    //     if (userId == null)
    //         return Unauthorized("Ugyldig eller manglende bruker-ID i token.");
    //
    //     try
    //     {
    //         await _messageService.UnblockGroupAsync(userId.Value, request.ConversationId);
    //         return Ok(new { message = "Gruppen er ikke lenger blokkert." });
    //     }
    //     catch (Exception ex)
    //     {
    //         return BadRequest(new { message = ex.Message });
    //     }
    // }
    
    

}