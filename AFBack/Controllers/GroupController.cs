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
public class GroupController : ControllerBase
{
    private readonly IGroupService _groupService;
    private readonly IHubContext<ChatHub> _hubContext;

    public GroupController(IGroupService groupService, IHubContext<ChatHub> hubContext)
    {
        _groupService = groupService;
        _hubContext = hubContext;
    }

    [HttpPost]
    public async Task<IActionResult> CreateGroup([FromBody] string groupName)
    {
        if (string.IsNullOrWhiteSpace(groupName))
            return BadRequest("Gruppenavn kan ikke være tomt.");

        try
        {
            var group = await _groupService.CreateGroupAsync(groupName);
            return Ok(group);
        }
        catch (Exception ex)
        {
            return BadRequest($"Kunne ikke opprette gruppe: {ex.Message}");
        }
    }

    [HttpPost("{groupId}/members")]
    public async Task<IActionResult> AddUserToGroup(int groupId, [FromBody] string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return BadRequest("UserId kan ikke være tom.");

        await _groupService.AddUserToGroupAsync(groupId, userId);

        // 🔥 Live legge brukeren til i SignalR-gruppen
        var group = await _groupService.GetGroupByIdAsync(groupId);
        if (group != null)
        {
            await _hubContext.Clients.User(userId).SendAsync("JoinGroup", group.Name);
        }

        return Ok();
    }

    [HttpDelete("{groupId}/members/{userId}")]
    public async Task<IActionResult> RemoveUserFromGroup(int groupId, string userId)
    {
        await _groupService.RemoveUserFromGroupAsync(groupId, userId);

        var group = await _groupService.GetGroupByIdAsync(groupId);
        if (group != null)
        {
            await _hubContext.Clients.User(userId).SendAsync("LeaveGroup", group.Name);
        }

        return Ok();
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMyGroups()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
            return Unauthorized();

        var groups = await _groupService.GetUserGroupsAsync(userId);
        return Ok(groups);
    }
}