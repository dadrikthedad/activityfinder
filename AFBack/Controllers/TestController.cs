using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using AFBack.Hubs;

namespace AFBack.Controllers;

[ApiController]
[Route("api/test-notification")]
public class NotificationTestController : ControllerBase
{
    private readonly IHubContext<UserHub> _hubContext;

    public NotificationTestController(IHubContext<UserHub> hubContext)
    {
        _hubContext = hubContext;
    }

    [HttpPost]
    public async Task<IActionResult> SendTestNotification()
    {
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", new
        {
            Id = 1,
            Type = "Test",
            Message = "🧪 Dette er en testmelding fra API!",
            CreatedAt = DateTime.UtcNow
        });

        return Ok(new { message = "Test notification sent." });
    }
}