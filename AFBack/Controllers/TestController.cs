using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using AFBack.Hubs;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SignalRTestController : ControllerBase
{
    private readonly IHubContext<UserHub> _hubContext;
    private readonly ILogger<SignalRTestController> _logger;

    public SignalRTestController(IHubContext<UserHub> hubContext, ILogger<SignalRTestController> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("broadcast-all")]
    public async Task<IActionResult> BroadcastToAll([FromBody] TestMessageDto message)
    {
        try
        {
            _logger.LogInformation("📢 Broadcasting test message to all connected clients");
            
            await _hubContext.Clients.All.SendAsync("TestMessage", new 
            { 
                Message = message.Message,
                Timestamp = DateTime.UtcNow,
                From = "System"
            });

            return Ok(new { success = true, message = "Broadcast sent to all clients" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to broadcast test message");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("send-to-user/{userId}")]
    public async Task<IActionResult> SendToUser(int userId, [FromBody] TestMessageDto message)
    {
        try
        {
            _logger.LogInformation("📤 Sending test message to user {UserId}", userId);
            
            await _hubContext.Clients.User(userId.ToString()).SendAsync("TestMessage", new 
            { 
                Message = message.Message,
                Timestamp = DateTime.UtcNow,
                From = "System",
                TargetUserId = userId
            });

            return Ok(new { success = true, message = $"Message sent to user {userId}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to send test message to user {UserId}", userId);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("send-to-group/{groupName}")]
    public async Task<IActionResult> SendToGroup(string groupName, [FromBody] TestMessageDto message)
    {
        try
        {
            _logger.LogInformation("📤 Sending test message to group {GroupName}", groupName);
            
            await _hubContext.Clients.Group(groupName).SendAsync("TestMessage", new 
            { 
                Message = message.Message,
                Timestamp = DateTime.UtcNow,
                From = "System",
                TargetGroup = groupName
            });

            return Ok(new { success = true, message = $"Message sent to group {groupName}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to send test message to group {GroupName}", groupName);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpGet("connections")]
    public async Task<IActionResult> GetConnections()
    {
        try
        {
            // Dette krever at du implementerer connection tracking
            // For nå, sender vi bare en test melding og ser hvem som svarer
            
            _logger.LogInformation("🔍 Testing connections by sending ping");
            
            await _hubContext.Clients.All.SendAsync("Ping", new 
            { 
                Message = "Connection test ping",
                Timestamp = DateTime.UtcNow 
            });

            return Ok(new { success = true, message = "Ping sent to all connections" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to test connections");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("test-receive-message")]
    public async Task<IActionResult> TestReceiveMessage([FromBody] TestReceiveMessageDto testData)
    {
        try
        {
            _logger.LogInformation("🧪 Testing ReceiveMessage event for user {UserId}", testData.UserId);
            
            var testMessage = new
            {
                Id = testData.MessageId ?? 999,
                SenderId = testData.SenderId ?? 1,
                Text = testData.Message ?? "Test message",
                SentAt = DateTime.UtcNow,
                ConversationId = testData.ConversationId ?? 1,
                IsSilent = testData.IsSilent,
                Sender = new 
                {
                    Id = testData.SenderId ?? 1,
                    FullName = "Test Sender",
                    ProfileImageUrl = (string?)null
                },
                Attachments = new List<object>(),
                Reactions = new List<object>()
            };

            await _hubContext.Clients.User(testData.UserId.ToString())
                .SendAsync("ReceiveMessage", testMessage);

            return Ok(new { success = true, message = $"Test ReceiveMessage sent to user {testData.UserId}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to send test ReceiveMessage to user {UserId}", testData.UserId);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }
}

public class TestMessageDto
{
    public string Message { get; set; } = string.Empty;
}

public class TestReceiveMessageDto
{
    public int UserId { get; set; }
    public int? MessageId { get; set; }
    public int? SenderId { get; set; }
    public int? ConversationId { get; set; }
    public string? Message { get; set; }
    public bool IsSilent { get; set; }
}