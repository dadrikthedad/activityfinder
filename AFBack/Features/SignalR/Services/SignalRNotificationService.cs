using AFBack.Features.SignalR.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Service for å sende SignalR-meldinger til klienter.
/// Wrapper rundt IHubContext med feilhåndtering og logging.
/// </summary>
public class SignalRNotificationService(
    IHubContext<UserHub> hubContext,
    ILogger<SignalRNotificationService> logger)
    : ISignalRNotificationService
{
    /// <inheritdoc />
    public async Task SendToUserAsync(string userId, string eventName, object payload, string context)
    {
        try
        {
            await hubContext.Clients.User(userId).SendAsync(eventName, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send SignalR '{EventName}' to user {UserId} for {Context}",
                eventName, userId, context);
        }
    }

    /// <inheritdoc />
    public async Task SendToUsersAsync(IEnumerable<string> userIds, string eventName, object payload, string context)
    {
        try
        {
            await hubContext.Clients.Users(userIds).SendAsync(eventName, payload);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send SignalR '{EventName}' to users for {Context}",
                eventName, context);
        }
    }
}
