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

    [HttpPost] // Her sender vi meldinger, tar imot SendMessageRequestDTO og sender til bruker
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequestDTO request)
    {
        
        // if (!int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
        //     return Unauthorized();
        
        var senderId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (senderId == null)
        {
            return Unauthorized();
        }

        var response = await _messageService.SendMessageAsync(senderId, request);
        return Ok(response);
    }
    
    // Her henter vi alle meldinger til å vise i innbox
    [HttpGet]
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
    public async Task<IActionResult> UploadAttachment([FromForm] IFormFile file)
    {
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