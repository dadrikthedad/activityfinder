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

        // 🆕 Bruk WebSocket-spesifikk metode med ConnectionId
        await _onlineService.SetWebSocketConnectedAsync(
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

        // Legg til i en gruppe basert på userId for enkel messaging
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

        _logger.Information($"✅ SignalR: Bruker {userId} tilkoblet på enhet {deviceId} ({platform}) med connection {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var userId))
        {
            var deviceId = Context.GetHttpContext()?.Request.Query["deviceId"].FirstOrDefault() 
                          ?? Context.ConnectionId;

            // 🆕 Bruk WebSocket-spesifikk disconnection method
            var disconnectionReason = exception?.Message ?? "Normal disconnection";
            await _onlineService.SetWebSocketDisconnectedAsync(userId, deviceId, Context.ConnectionId, disconnectionReason);

            _logger.Information($"🔌 SignalR: Bruker {userId} frakoblet fra enhet {deviceId} (connection {Context.ConnectionId})");
            
            if (exception != null)
            {
                _logger.Warning(exception, $"⚠️ SignalR: Bruker {userId} frakoblet med feil på enhet {deviceId}");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
    
}