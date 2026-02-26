using System.ComponentModel.DataAnnotations;
using AFBack.Common.Controllers;
using AFBack.Common.DTOs;
using AFBack.Features.Friendship.DTOs.Requests;
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
    
    // ======================= FRIENDSHIP ======================= 
    [HttpDelete("{friendId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveFriendship(
        [FromRoute]
        [Required(ErrorMessage = "FriendId is required")]
        string friendId)
    {
        var userId = User.GetUserId();
        var result = await friendshipService.RemoveFriendshipAsync(userId, friendId);

        if (result.IsFailure)
            return HandleFailure(result);

        return NoContent();
    }
    
    [HttpGet]
    [ProducesResponseType(typeof(List<UserSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyFriends()
    {
        var userId = User.GetUserId();
        var result = await friendshipService.GetMyFriendsAsync(userId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(UserFriendsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserFriends(
        [FromRoute]
        [Required(ErrorMessage = "UserId is required")]
        string userId)
    {
        var myUserId = User.GetUserId();
        var result = await friendshipService.GetUserFriendsAsync(myUserId, userId);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
    // ======================= FRIENDSHIP REQUESTS ======================= 
    [HttpGet("requests")]
    [ProducesResponseType(typeof(List<PendingFriendshipRequestResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReceivedPendingFriendshipRequests([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();
        var result = await friendshipRequestService.GetReceivedPendingFriendshipRequestsAsync(userId,
            request.Page, request.PageSize);
    
        if (result.IsFailure)
            return HandleFailure(result);
    
        return Ok(result.Value);
    }
    
    [HttpGet("requests/declined")]
    [ProducesResponseType(typeof(PaginatedResponse<PendingFriendshipRequestResponse>), 
        StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDeclinedFriendshipRequests([FromQuery] PaginationRequest request)
    {
        var userId = User.GetUserId();
        var result = await friendshipRequestService.GetDeclinedFriendshipRequestsAsync(userId,
            request.Page, request.PageSize);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
    
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
    
    [HttpPost("{userId}/search")]
    [ProducesResponseType(typeof(PaginatedResponse<UserSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SearchFriends(
        [FromRoute] string userId,
        [FromBody] SearchFriendRequest request)
    {
        var myUserId = User.GetUserId();
        var result = await friendshipService.SearchFriendsAsync(myUserId, userId, request.Query, 
            request.PaginationRequest.Page, request.PaginationRequest.PageSize);

        if (result.IsFailure)
            return HandleFailure(result);

        return Ok(result.Value);
    }
}
