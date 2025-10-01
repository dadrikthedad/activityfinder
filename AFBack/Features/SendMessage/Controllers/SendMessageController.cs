using AFBack.Controllers;
using AFBack.Data;
using AFBack.Features.Cache.Interface;
using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Infrastructure.DTO;
using AFBack.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AFBack.Features.SendMessage.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("messaging")]
public class SendMessageController(
    ApplicationDbContext context,
    ILogger<SendMessageController> logger,
    ISendMessageService sendMessageService,
    IUserCache userCache,
    ResponseService responseService)
    : BaseController<SendMessageController>(context, logger, userCache, responseService)
{
    private readonly ISendMessageService _sendMessageService = sendMessageService;
    
    // Hoved SendMessage metoden. Brukes kun fra samtalelisten til eksisterende samtaler. Krever ConversationId
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SendMessageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ApiResponse<SendMessageResponse>>> SendMessage([FromBody] SendMessageRequest request)
    {
        var (userId, error) = await ValidateAndGetIdFromToken<SendMessageResponse>();
        if (error != null)
            return error;
        
        // Validerer DTOen sine attributter
        var contentValidationError = ValidateCondition<SendMessageResponse>(!request.HasValidContent,
            "SendMessageController: User {UserId} attempted to send Empty Message",
            "The message must contain text or attachments", userId);
        if (contentValidationError != null)
            return contentValidationError;

        _logger.LogInformation("SendMessageController: Sending message for user {UserId} to conversation {ConversationId}", userId,
            request.ConversationId);
        
      
        // Bruker SendMessageAsync hovedmetoden for melding
        var response = await _sendMessageService.SendMessageAsync(request, userId);
        _logger.LogInformation("SendMessageController: User {UserId} successfully sent message with Id {MessageId} to {ConversationId}", userId,
                response.MessageId, request.ConversationId);
        
        // Returner Ok() hvis det var en suksess
        return _responseService.Success(response, "Message sent successfully");
    }
    
    
    

    // [HttpPost("message-request")]
    // public async Task<IActionResult> SendMessageRequest([FromBody] SendMessageRequestRequest request)
    // {
    //     var user = await GetUserFromClaims();
    //     if (user == null)
    //     {
    //         _logger.LogWarning("Unauthorized access attempt - invalid user claims");
    //         return Unauthorized("Invalid or missing UserId");
    //     }
    //     
    //     if (!ModelState.IsValid)
    //     {
    //         _logger.LogWarning("No receiver Id to SendMessageRequest");
    //         return BadRequest($"Empty receiver Id");
    //     }
    //     
    //     _logger.LogInformation("Creating Message request from {UserId} to receiver {ReceiverId}", user.Id,
    //         request.RequestReceiverId);
    //
    //     try
    //     {
    //         var response = await sendMessageService.SendMessageRequestAsync(request, user);
    //         _logger.LogInformation("User {UserId} sendt receiver {ReceiverId} message request with MessageRequestId {MessageRequestId}. " +
    //                                "Conversation with Id {ConversationId} created", user.Id, 
    //             request.RequestReceiverId, response.MessageRequestId, response.ConversationId);
    //
    //         return Ok(response);
    //     }
    //     catch (Exception ex)
    //     {
    //         _logger.LogError(ex,
    //             "Error while creating MessageRequest for initiator {UserId} and receiver {ReceiverId}", user.Id,
    //             request.RequestReceiverId);
    //         return StatusCode(500, new { Message = $"Error on SendMessageRequest: {ex.Message}" });
    //     }
    // }
    
}
