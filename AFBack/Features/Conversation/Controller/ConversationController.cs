using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Common.DTOs;
using AFBack.Controllers;
using AFBack.Features.Conversation.DTOs.Request;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.Conversation.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Conversation.Controller;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ConversationController(
    IGetConversationsService getConversationsService,
    IDirectConversationService directConversationService,
    IArchiveConversationService archiveConversationService,
    ISearchConversationsService searchConversationsService) : BaseController
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
        
        var result = await getConversationsService.GetConversationAsync(userId, conversationId);
        
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
        
        var result = await getConversationsService.GetActiveConversationsAsync(userId, request);
        
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
        
        var result = await getConversationsService.GetPendingConversationsAsync(userId, request);
        
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
        
        var result = await getConversationsService.GetArchivedConversationsAsync(userId, request);
        
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
        
        var result = await getConversationsService.GetRejectedConversationsAsync(userId, request);
        
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
        
        var result = await searchConversationsService.SearchConversationsAsync(userId, request);

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
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> ArchiveConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId(); 

        var result = await archiveConversationService.ArchiveConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    /// <summary>
    /// Gjenopprettet arkiveringen av en brukers samtale
    /// </summary>
    /// <param name="conversationId">Samtalen bruker vil ha gjenopprettet</param>
    /// <returns>Ok 200 med en ConversationResponse for å gjenopprette samtalen</returns>
    [HttpPost("{conversationId:int}/restore")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> RestoreArchivedConversation(
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId(); 

        var result = await archiveConversationService.RestoreArchivedConversationAsync(userId, conversationId);
        
        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    /// <summary>
    /// Brukes i NewMessage-komponenten.
    /// Sender en melding til en bruker for 1-1 samtaler, og håndterer både eksisterende samtaler og opprettelse
    /// av nye samtaler. Auto-aksepterer samtalen hvis avsender av melding er pending i samtalen.
    /// Er brukerne venner så opprettes en samtale, men en melding vises som vanlig for brukeren. Metoden putter
    /// brukerne i CanSend hvis begge er venner.
    /// Sender SignalR, lager MessageNotification og SyncEvent hvis samtalen blir opprettet
    /// </summary>
    /// <param name="request"></param>
    /// <returns>Ok 200 med en SendMessageToUserResponse</returns>
    [HttpPost("send-to-user")]
    [ProducesResponseType(typeof(SendMessageToUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SendMessageToUserResponse>> SendMessageToUser(
        [FromBody] SendMessageToUserRequest request)
    {
        var userId = User.GetUserId();

        var result = await directConversationService.SendMessageToUserAsync(userId, request);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    
    /// <summary>
    /// Aksepterer en pending conversation request. Endrer conversation type fra PendingRequest til DirectChat,
    /// oppdaterer begge participants til Accepted status, legger begge brukere inn i CanSend cache,
    /// sender systemmelding, oppretter SyncEvent for begge brukere, sender SignalR til mottaker sine andre enheter,
    /// og oppretter notification for mottaker
    /// </summary>
    /// <param name="conversationId">Samtalen som ble godkjent</param>
    /// <returns>ConversationResponse til frontend for å legge rett i riktig samtale</returns>
    [HttpPost("{conversationId:int}/accept")]
    [ProducesResponseType(typeof(ConversationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationResponse>> AcceptPendingConversationRequest( 
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await directConversationService.AcceptPendingConversationRequestAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    
    /// <summary>
    /// Avslår en pending conversation request. Oppdaterer brukerens participant status til Rejected.
    /// Sender ikke notifikasjon til sender (de skal ikke vite om avslag).
    /// </summary>
    /// <param name="conversationId">Samtalen som skal avslås</param>
    /// <returns>204 No Content</returns>
    [HttpPost("{conversationId:int}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult> RejectedPendingConversationRequest( 
        [FromRoute]
        [Required(ErrorMessage = "ConversationId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "ConversationId must be greater than 0")]
        int conversationId)
    {
        var userId = User.GetUserId();

        var result = await directConversationService.AcceptPendingConversationRequestAsync(userId, conversationId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }

}
