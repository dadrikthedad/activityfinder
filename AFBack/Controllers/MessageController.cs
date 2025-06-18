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
    
    // 
    [HttpGet("pending/{conversationId}")]
    public async Task<IActionResult> GetPendingMessageRequestById(int conversationId)
    {
        var receiverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(receiverIdClaim, out var receiverId))
            return Unauthorized("Ugyldig bruker-ID.");

        // ✅ Sjekk først hvilken type samtale det er
        var conversation = await _context.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            return NotFound("Samtalen finnes ikke.");

        if (conversation.IsGroup)
        {
            // ✅ Hent pending GroupRequest
            var groupRequest = await _context.GroupRequests
                .Where(gr => gr.ReceiverId == receiverId && gr.Status == GroupRequestStatus.Pending && gr.ConversationId == conversationId)
                .Include(gr => gr.Sender).ThenInclude(u => u.Profile)
                .Include(gr => gr.Conversation)
                .FirstOrDefaultAsync();

            if (groupRequest == null)
                return NotFound("Ingen pending gruppe-invitasjon funnet.");

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
                IsPendingApproval = true
            });
        }
        else
        {
            // ✅ Hent pending MessageRequest
            var messageRequest = await _context.MessageRequests
                .Where(r => r.ReceiverId == receiverId && !r.IsAccepted && !r.IsRejected && r.ConversationId == conversationId)
                .Include(r => r.Sender).ThenInclude(u => u.Profile)
                .Include(r => r.Conversation)
                .FirstOrDefaultAsync();

            if (messageRequest == null)
                return NotFound("Ingen pending message request funnet.");

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
    

}