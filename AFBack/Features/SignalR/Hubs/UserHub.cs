using AFBack.Features.SignalR.Constants;
using AFBack.Features.SignalR.DTOs;
using AFBack.Features.SignalR.DTOs.Responses;
using AFBack.Features.SignalR.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AFBack.Features.SignalR.Hubs;

/// <summary>
/// SignalR hub for sanntidskommunikasjon med tilkoblede brukere.
/// Håndterer connection lifecycle, device collisions, og multi-device notifications.
/// </summary>
[Authorize]
public class UserHub(
    IHubConnectionService connectionService,
    IConversationPresenceService presenceService,
    ILogger<UserHub> logger) : Hub<IUserHubClient>
{
    /// <summary>
    /// Kalles ved ny WebSocket-tilkobling.
    /// Registrerer connection, håndterer device collision, og varsler andre enheter.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var metadata = ConnectionMetadataExtractor.ExtractMetadata(Context);
        
        if (metadata == null)
        {
            logger.LogWarning("SignalR: Mangler eller ugyldig bruker-ID ved tilkobling");
            await base.OnConnectedAsync();
            return;
        }

        try
        {
            var result = await connectionService.RegisterConnectionAsync(
                metadata, 
                Context.ConnectionAborted);

            if (!result.Success)
            {
                await SendConnectionErrorAsync("Failed to establish connection", result.ErrorMessage ?? "Unknown error");
                Context.Abort();
                return;
            }

            await HandleCollisionIfNeededAsync(result, metadata);
            await AddToUserGroupAsync(metadata.UserId);
            await NotifyOtherDevicesIfNeededAsync(result, metadata);

            logger.LogInformation(
                "SignalR: User {UserId} connected on device {DeviceId} ({Platform})",
                metadata.UserId, metadata.DeviceId, metadata.Platform);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation(
                "SignalR: Connection cancelled for user {UserId}", 
                metadata.UserId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, 
                "SignalR: Error during connection setup for user {UserId}", 
                metadata.UserId);
            
            await SendConnectionErrorAsync("Failed to establish connection", ex.Message);
            Context.Abort();
            return;
        }

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Kalles ved disconnect. Avregistrerer connection og fjerner bruker fra alle samtaler.
    /// </summary>
    /// <param name="exception">Feil som forårsaket disconnect, eller null ved normal disconnect</param>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (!ConnectionMetadataExtractor.TryGetUserId(Context, out var userId) || userId == null)
        {
            await base.OnDisconnectedAsync(exception);
            return;
        }

        var deviceId = ConnectionMetadataExtractor.GetDeviceId(Context);
        var disconnectionReason = exception?.Message ?? "Normal disconnection";

        try
        {
            // Fjern bruker fra alle samtaler ved disconnect
            await presenceService.LeaveAllConversationsAsync(userId);
            
            await connectionService.UnregisterConnectionAsync(
                userId,
                deviceId,
                Context.ConnectionId,
                disconnectionReason,
                CancellationToken.None);

            if (exception != null)
            {
                logger.LogWarning(exception,
                    "SignalR: User {UserId} disconnected with error from device {DeviceId}",
                    userId, deviceId);
            }
            else
            {
                logger.LogInformation(
                    "SignalR: User {UserId} disconnected from device {DeviceId}",
                    userId, deviceId);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "SignalR: Error during disconnection cleanup for user {UserId}",
                userId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Health check for klient-side connection monitoring.
    /// </summary>
    /// <returns>"pong"</returns>
    public string Ping() => "pong";

    /// <summary>
    /// Klienten kaller denne når bruker åpner/går inn i en samtale.
    /// Registrerer at brukeren er aktiv i samtalen for å unngå unødvendige notifications.
    /// </summary>
    /// <param name="conversationId">Samtale-ID brukeren åpner</param>
    public async Task JoinConversation(int conversationId)
    {
        if (!ConnectionMetadataExtractor.TryGetUserId(Context, out var userId) || userId == null)
            return;

        await presenceService.JoinConversationAsync(userId, conversationId);
        await Groups.AddToGroupAsync(Context.ConnectionId, HubConstants.Groups
            .ForConversation(conversationId));
        
        logger.LogDebug("User {UserId} joined conversation {ConversationId}", userId, conversationId);
    }

    /// <summary>
    /// Klienten kaller denne når bruker lukker/navigerer bort fra en samtale.
    /// </summary>
    /// <param name="conversationId">Samtale-ID brukeren forlater</param>
    public async Task LeaveConversation(int conversationId)
    {
        if (!ConnectionMetadataExtractor.TryGetUserId(Context, out var userId) || userId == null)
            return;

        await presenceService.LeaveConversationAsync(userId, conversationId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubConstants.Groups
            .ForConversation(conversationId));
        
        logger.LogDebug("User {UserId} left conversation {ConversationId}", userId, conversationId);
    }

    #region Private Helpers

    /// <summary>
    /// Sender DeviceCollision event til tidligere connection hvis samme enhet kobler til fra ny lokasjon.
    /// </summary>
    private async Task HandleCollisionIfNeededAsync(ConnectionResult result, ConnectionMetadata metadata)
    {
        if (!result.HasCollision || string.IsNullOrEmpty(result.PreviousConnectionId)) 
            return;

        logger.LogInformation(
            "Device collision for user {UserId}, device {DeviceId}. Previous: {PreviousConnectionId}",
            metadata.UserId, metadata.DeviceId, result.PreviousConnectionId);

        try
        {
            await Clients.Client(result.PreviousConnectionId).DeviceCollision(new DeviceCollisionResponse
            {
                Message = "Same device connected from another location",
                NewPlatform = metadata.Platform,
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Failed to send collision event to {PreviousConnectionId}",
                result.PreviousConnectionId);
        }
    }

    /// <summary>
    /// Legger connection til brukerens SignalR-gruppe for targeted messaging.
    /// </summary>
    private async Task AddToUserGroupAsync(string userId)
    {
        var groupName = HubConstants.Groups.ForUser(userId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName, Context.ConnectionAborted);
    }

    /// <summary>
    /// Varsler brukerens andre aktive enheter om ny innlogging.
    /// </summary>
    private async Task NotifyOtherDevicesIfNeededAsync(ConnectionResult result, ConnectionMetadata metadata)
    {
        if (result.OtherDeviceConnections.Count == 0) 
            return;

        logger.LogInformation(
            "Notifying {Count} other devices about new login for user {UserId}",
            result.OtherDeviceConnections.Count, metadata.UserId);

        var response = new LoggedInElsewhereResponse
        {
            Message = "You logged in from another device",
            DeviceInfo = $"{metadata.Platform} device",
            Timestamp = DateTime.UtcNow
        };

        await Clients.Clients(result.OtherDeviceConnections).UserLoggedInElsewhere(response);
    }

    /// <summary>
    /// Sender ConnectionError event til klienten.
    /// </summary>
    private async Task SendConnectionErrorAsync(string error, string reason)
    {
        await Clients.Caller.ConnectionError(new ConnectionErrorResponse
        {
            Error = error,
            Reason = reason,
            ShouldRetry = true
        });
    }

    #endregion
}
