using System.Diagnostics;
using AFBack.Cache;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using AFBack.Hubs;
using Microsoft.Extensions.Caching.Distributed;

namespace AFBack.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SignalRTestController(
    IHubContext<UserHub> hubContext, 
    ILogger<SignalRTestController> logger,
    IDistributedCache distributedCache,
    IUserSummaryCacheService userSummaryCache)
    : ControllerBase
{
    [HttpPost("broadcast-all")]
    public async Task<IActionResult> BroadcastToAll([FromBody] TestMessageDto message)
    {
        try
        {
            logger.LogInformation("📢 Broadcasting test message to all connected clients");
            
            await hubContext.Clients.All.SendAsync("TestMessage", new 
            { 
                Message = message.Message,
                Timestamp = DateTime.UtcNow,
                From = "System"
            });

            return Ok(new { success = true, message = "Broadcast sent to all clients" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Failed to broadcast test message");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("send-to-appUser/{userId}")]
    public async Task<IActionResult> SendToUser(int userId, [FromBody] TestMessageDto message)
    {
        try
        {
            logger.LogInformation("📤 Sending test message to appUser {UserId}", userId);
            
            await hubContext.Clients.User(userId.ToString()).SendAsync("TestMessage", new 
            { 
                Message = message.Message,
                Timestamp = DateTime.UtcNow,
                From = "System",
                TargetUserId = userId
            });

            return Ok(new { success = true, message = $"Message sent to appUser {userId}" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Failed to send test message to appUser {UserId}", userId);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("send-to-group/{groupName}")]
    public async Task<IActionResult> SendToGroup(string groupName, [FromBody] TestMessageDto message)
    {
        try
        {
            logger.LogInformation("📤 Sending test message to group {GroupName}", groupName);
            
            await hubContext.Clients.Group(groupName).SendAsync("TestMessage", new 
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
            logger.LogError(ex, "❌ Failed to send test message to group {GroupName}", groupName);
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
            
            logger.LogInformation("🔍 Testing connections by sending ping");
            
            await hubContext.Clients.All.SendAsync("Ping", new 
            { 
                Message = "Connection test ping",
                Timestamp = DateTime.UtcNow 
            });

            return Ok(new { success = true, message = "Ping sent to all connections" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Failed to test connections");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpPost("test-receive-message")]
    public async Task<IActionResult> TestReceiveMessage([FromBody] TestReceiveMessageDto testData)
    {
        try
        {
            logger.LogInformation("🧪 Testing ReceiveMessage event for appUser {UserId}", testData.UserId);
            
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

            await hubContext.Clients.User(testData.UserId.ToString())
                .SendAsync("ReceiveMessage", testMessage);

            return Ok(new { success = true, message = $"Test ReceiveMessage sent to appUser {testData.UserId}" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "❌ Failed to send test ReceiveMessage to appUser {UserId}", testData.UserId);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }
    
    /// <summary>
    /// Tester at Redis fungerer
    /// </summary>
    [HttpGet("redis")]
    public async Task<IActionResult> TestRedis()
    {
        try
        {
            await distributedCache.SetStringAsync("test:key", "Hello Redis!");
            var value = await distributedCache.GetStringAsync("test:key");
            await distributedCache.RemoveAsync("test:key");

            return Ok(new
            {
                Status = "Redis works",
                TestValue = value
            });
        }
        catch (Exception ex)
        {
            return Problem($"Redis error: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Test endepunnkt for å sikre at Redis fungerer og cachings metodene fungerer
    /// </summary>
    [HttpGet("user-cache/{userId}")]
    public async Task<IActionResult> TestUserCache(string userId)
    {
        try
        {
            var sw = Stopwatch.StartNew();
            var user1 = await userSummaryCache.GetUserSummaryAsync(userId);
            var time1 = sw.ElapsedMilliseconds;

            sw.Restart();
            var user2 = await userSummaryCache.GetUserSummaryAsync(userId);
            var time2 = sw.ElapsedMilliseconds;

            return Ok(new
            {
                Status = "Cache works",
                User = user1,
                FirstCallMs = time1,
                SecondCallMs = time2,
                Speedup = time2 > 0
                    ? $"{(double)time1 / time2:F1}x"
                    : "Infinite"
            });
        }
        catch (Exception ex)
        {
            return Problem($"Cache error: {ex.Message}");
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
