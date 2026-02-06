using AFBack.Features.SignalR.DTOs.Responses;

namespace AFBack.Features.SignalR.Services;

/// <summary>
/// Strongly-typed interface for klient-metoder som serveren kan kalle.
/// Gir compile-time sikkerhet for SignalR events.
/// </summary>
public interface IUserHubClient
{
    // Connection events
    Task DeviceCollision(DeviceCollisionResponse response);
    Task UserLoggedInElsewhere(LoggedInElsewhereResponse response);
    Task ConnectionError(ConnectionErrorResponse response);
    
    // Messaging events
    Task ReceiveMessage(object message);
    Task MessageDeleted(object payload);
    Task MessageEdited(object payload);
    Task MessageReaction(object payload);
    
    // Conversation events
    Task ConversationCreated(object payload);
    Task ConversationUpdated(object payload);
    Task ConversationDeleted(object payload);
    Task ParticipantAdded(object payload);
    Task ParticipantRemoved(object payload);
    
    // Typing indicators
    Task UserTyping(object payload);
    Task UserStoppedTyping(object payload);
    
    // Presence events
    Task UserOnline(object payload);
    Task UserOffline(object payload);
    
    // Sync events
    Task SyncRequired(object payload);
}
