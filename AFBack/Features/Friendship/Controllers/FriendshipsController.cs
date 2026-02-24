using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Features.Friendship.DTOs.Responses;
using AFBack.Features.Friendship.Services;
using AFBack.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AFBack.Features.Friendship.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FriendshipsController(IFriendshipService friendshipService,
    IFriendshipRequestService friendshipRequestService) : BaseController
{
    
    [HttpPost("requests/{receiverId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SendFriendshipRequest(
        [FromRoute] 
        [Required(ErrorMessage = "ReceiverId is required")]
        string receiverId)
    {
        var userId = User.GetUserId(); 
        
        var result = await friendshipRequestService.SendFriendshipRequestAsync(userId, receiverId);
        
        if (result.IsFailure)
            return HandleFailure(result);
        
        return Ok(result.Value);
    }
    
    [HttpPut("requests/{friendshipRequestId:int}/accept")]
    [ProducesResponseType(typeof(FriendshipAcceptedResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AcceptFriendshipRequest(
        [FromRoute] 
        [Required(ErrorMessage = "FriendshipRequestId is required")]
        int friendshipRequestId)
    {
        var userId = User.GetUserId();
        var result = await friendshipRequestService.AcceptFriendshipRequestAsync(userId, friendshipRequestId);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    [HttpPut("requests/{friendshipRequestId:int}/decline")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeclineFriendshipRequest(
        [FromRoute] 
        [Required(ErrorMessage = "FriendshipRequestId is required")]
        int friendshipRequestId)
    {
        var userId = User.GetUserId();
        var result = await friendshipRequestService.DeclineFriendshipRequestAsync(userId, friendshipRequestId);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return NoContent();
    }
}
