using System.Security.Claims;
using AFBack.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Serilog;
using ILogger = Serilog.ILogger;

namespace AFBack.Hubs;

[Authorize]
public class UserHub : Hub
{
    private static readonly ILogger _logger = Log.ForContext<UserHub>();
    private readonly UserOnlineService _onlineService;

    public UserHub(UserOnlineService onlineService)
    {
        _onlineService = onlineService;
    }

    public override async Task OnConnectedAsync()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            _logger.Warning("❗ SignalR: Mangler eller ugyldig bruker-ID ved tilkobling.");
            await base.OnConnectedAsync();
            return;
        }

        // Hent device info fra query string eller headers
        var deviceId = Context.GetHttpContext()?.Request.Query["deviceId"].FirstOrDefault() 
                      ?? Context.ConnectionId; // Fallback til ConnectionId
        var platform = Context.GetHttpContext()?.Request.Query["platform"].FirstOrDefault() 
                      ?? "web";
        var capabilities = Context.GetHttpContext()?.Request.Query["capabilities"]
                         .FirstOrDefault()?.Split(',') ?? Array.Empty<string>();

        try
        {
            // 🆕 Registrer connection og la UserOnlineService håndtere collision logic
            var connectionResult = await _onlineService.SetWebSocketConnectedAsync(
                userId, 
                deviceId, 
                Context.ConnectionId, 
                platform, 
                capabilities,
                new { 
                    UserAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].FirstOrDefault(),
                    RemoteIpAddress = Context.GetHttpContext()?.Connection?.RemoteIpAddress?.ToString(),
                    ConnectedAt = DateTime.UtcNow
                });

            // 🆕 Sjekk om service returnerte collision info
            if (connectionResult?.HasCollision == true && !string.IsNullOrEmpty(connectionResult.PreviousConnectionId))
            {
                _logger.Information($"🔀 SignalR: Device collision detected for user {userId}, device {deviceId}. Previous connection: {connectionResult.PreviousConnectionId}");
                
                // Send collision event til gamle connection
                try
                {
                    await Clients.Client(connectionResult.PreviousConnectionId).SendAsync("DeviceCollision", 
                        $"Same device connected from another location. Platform: {platform}");
                }
                catch (Exception ex)
                {
                    _logger.Warning(ex, $"Failed to send collision event to {connectionResult.PreviousConnectionId}");
                }
            }

            // Legg til i grupper for messaging
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

            // 🆕 Notify andre enheter hvis ønskelig (basert på connectionResult)
            if (connectionResult?.OtherDeviceConnections?.Any() == true)
            {
                await Clients.Clients(connectionResult.OtherDeviceConnections).SendAsync("UserLoggedInElsewhere", new
                {
                    Message = $"You logged in from another device: {platform}",
                    DeviceInfo = $"{platform} device",
                    Timestamp = DateTime.UtcNow
                });
                
                _logger.Information($"📱 SignalR: Notified {connectionResult.OtherDeviceConnections.Count} other devices about new login for user {userId}");
            }

            _logger.Information($"✅ SignalR: User {userId} connected on device {deviceId} ({platform}) with connection {Context.ConnectionId}");
        }
        catch (Exception ex)
        {
            _logger.Error(ex, $"❌ SignalR: Error during connection setup for user {userId}");
            
            // Send error til client
            await Clients.Caller.SendAsync("ConnectionError", new
            {
                Error = "Failed to establish connection",
                Reason = ex.Message,
                ShouldRetry = true
            });
            
            // Disconnect problematic connection
            Context.Abort();
            return;
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var userId))
        {
            var deviceId = Context.GetHttpContext()?.Request.Query["deviceId"].FirstOrDefault() 
                          ?? Context.ConnectionId;

            try
            {
                // 🆕 Bruk WebSocket-spesifikk disconnection method
                var disconnectionReason = exception?.Message ?? "Normal disconnection";
                await _onlineService.SetWebSocketDisconnectedAsync(userId, deviceId, Context.ConnectionId, disconnectionReason);

                _logger.Information($"🔌 SignalR: User {userId} disconnected from device {deviceId} (connection {Context.ConnectionId})");
                
                if (exception != null)
                {
                    _logger.Warning(exception, $"⚠️ SignalR: User {userId} disconnected with error from device {deviceId}");
                }
            }
            catch (Exception ex)
            {
                _logger.Error(ex, $"❌ SignalR: Error during disconnection cleanup for user {userId}");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // 🆕 Ping/Health check method for client-side monitoring
    public async Task<string> Ping()
    {
        return "pong";
    }

    // 🆕 Get connection info for debugging
    public async Task<object> GetConnectionInfo()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        return new
        {
            ConnectionId = Context.ConnectionId,
            UserId = userIdClaim,
            ConnectedAt = DateTime.UtcNow,
            UserAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].FirstOrDefault()
        };
    }
}