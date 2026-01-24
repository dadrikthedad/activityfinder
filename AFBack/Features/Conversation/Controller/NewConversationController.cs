using System.ComponentModel.DataAnnotations;
using AFBack.Common.DTOs;
using AFBack.Controllers;
using AFBack.Features.Conversation.DTOs;
using AFBack.Features.Conversation.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Conversation.Controller;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class NewConversationController(
    INewConversationService newConversationService) : BaseController
{
    
    /// <summary>
    /// Dette endepunktet henter ut kun en samtale som brukeren er participant i.
    /// </summary>
    /// <param name="conversationId">Samtalen som skal hentes</param>
    /// <returns>Ok 200 med ConversationResponse eller 404 Not Found</returns>
    [HttpGet("{conversationId}")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> GetConversationById(
        [FromRoute] 
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")] 
        int conversationId)
    {
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.GetConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter aktive samtaler - samtaler brukeren selv har akseptert/opprettet. 1v1, pending og gruppe
    /// </summary>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Ok 200 med ConversationsResponse eller tom liste</returns>
    [HttpGet("active")]
    [ProducesResponseType(typeof(ConversationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationsResponse>> GetActiveConversations([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.GetActiveConversationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter pending samtaler - samtaler brukeren selv har mottatt en conversationrequest.
    /// </summary>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Ok 200 med ConversationsResponse eller tom liste</returns>
    [HttpGet("pending")]
    [ProducesResponseType(typeof(ConversationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationsResponse>> GetPendingConversations([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.GetPendingConversationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter arkiverte samtaler - samtaler brukeren selv har arkivert.
    /// </summary>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Ok 200 med ConversationsResponse eller tom liste</returns>
    [HttpGet("archived")]
    [ProducesResponseType(typeof(ConversationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationsResponse>> GetArchivedConversations([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.GetArchivedConversationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Henter rejecta samtaler - samtaler brukeren selv har avslått.
    /// </summary>
    /// <param name="request">PaginationRequest med page og pagesize</param>
    /// <returns>Ok 200 med ConversationsResponse eller tom liste</returns>
    [HttpGet("rejected")]
    [ProducesResponseType(typeof(ConversationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationsResponse>> GetRejectedConversations([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.GetRejectedConversationsAsync(userId, request);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
 
    
    /// <summary>
    /// Søker etter samtaler i samtalelisten til brukern
    /// </summary>
    /// <param name="request">ConversationsResponse med søkequery, pagesize og page</param>
    /// <returns>Ok 200 Liste med ConversationsResponse eller tom liste</returns>
    [HttpGet("search")]
    [ProducesResponseType(typeof(ConversationsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationsResponse>> SearchConversations(
        [FromQuery] ConversationSearchRequest request)
    {
        // Validerer at brukeren eksistere
        var userId = User.GetUserId(); 
        
        var result = await newConversationService.SearchConversationsAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    
    /// <summary>
    /// Arkiver en brukers samtale
    /// </summary>
    /// <param name="conversationId">Samtalen bruker vil ha arkivert</param>
    /// <returns>204 No Content</returns>
    [HttpDelete("{conversationId}")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ProblemDetails>> ArchiveConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId(); 

        var result = await newConversationService.ArchiveConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Gjenopprettet arkiveringen av en brukers samtale
    /// </summary>
    /// <param name="conversationId">Samtalen bruker vil ha gjenopprettet</param>
    /// <returns>Ok 200 med en ConversationResponse for å gjenopprette samtalen</returns>
    [HttpPost("restore/{conversationId}")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ProblemDetails>> RestoreArchivedConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId(); 

        var result = await newConversationService.RestoreArchivedConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }

    [HttpPost("send-to-user")]
    public async Task<ActionResult<ProblemDetails>> SendMessageToUser([FromBody] SendMessageToUserRequest request)
    {
        var userId = User.GetUserId();

        var result = await newConversationService.SendMessageToUserAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }

}
