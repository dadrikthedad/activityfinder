using AFBack.DTOs;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly IMessageService _messageService;
    private readonly IFileService _fileService;

    public MessagesController(IMessageService messageService, IFileService fileService)
    {
        _messageService = messageService;
        _fileService = fileService;
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequestDTO request)
    {
        var senderIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(senderIdStr))
        {
            return Unauthorized(new { message = "Ingen bruker-ID funnet i token." });
        }

        // Her kan vi legge på en strengere parsing hvis vi forventer int
        if (!int.TryParse(senderIdStr, out var senderId))
        {
            return Unauthorized(new { message = "Ugyldig bruker-ID format. Forventer tallverdi." });
        }

        if (request == null)
        {
            return BadRequest(new { message = "Request-body er tom." });
        }

        if (string.IsNullOrWhiteSpace(request.Text) && (request.Attachments == null || request.Attachments.Count == 0))
        {
            return BadRequest(new { message = "Meldingen må inneholde tekst eller minst ett vedlegg." });
        }

        try
        {
            var response = await _messageService.SendMessageAsync(senderIdStr, request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            // Hvis du vil være enda snillere mot frontend:
            return StatusCode(500, new { message = "Det oppstod en feil ved sending av melding.", details = ex.Message });
        }
    }
    
    // Her henter vi alle meldinger til å vise i innbox
    [HttpGet("my")]
    public async Task<IActionResult> GetMyMessages()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
        {
            return Unauthorized();
        }

        var messages = await _messageService.GetMessagesForUserAsync(userId);
        return Ok(messages);
    }
    
    [HttpGet] // prøver denne for å hente noen meldinger omgangen
    public async Task<IActionResult> GetMessages([FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
        {
            return Unauthorized();
        }
        
        var messages = await _messageService.GetMessagesAsync(skip, take);
        return Ok(messages);
    }
    
    // 
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
}