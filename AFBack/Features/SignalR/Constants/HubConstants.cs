namespace AFBack.Features.SignalR.Constants;

/// <summary>
/// Sentraliserte konstanter for SignalR-operasjoner.
/// Eliminerer magic strings og gir compile-time sikkerhet.
/// </summary>
public static class HubConstants
{
    /// <summary>
    /// Server-to-client events som klienten lytter på.
    /// </summary>
    public static class ClientEvents
    {
        // Connection events
        public const string DeviceCollision = "DeviceCollision";
        public const string UserLoggedInElsewhere = "UserLoggedInElsewhere";
        public const string ConnectionError = "ConnectionError";
        
        // Profile Events
        // User profile events
        public const string UserProfileUpdated = "UserProfileUpdated";
        
        // Messaging events
        public const string ReceiveMessage = "ReceiveMessage";
        public const string MessageDeleted = "MessageDeleted";
        public const string MessageEdited = "MessageEdited";
        public const string MessageReaction = "MessageReaction";
        
        // Direct conversation events
        public const string IncomingDirectConversation = "IncomingDirectConversation";
        public const string IncomingPendingRequest = "IncomingPendingRequest";
        public const string ConversationAccepted = "ConversationAccepted";
        public const string ConversationCreated = "ConversationCreated";
        public const string ConversationUpdated = "ConversationUpdated";
        public const string ConversationDeleted = "ConversationDeleted";
        
        // Group events
        public const string GroupInviteReceived = "GroupInviteReceived";
        public const string GroupInfoUpdated = "GroupInfoUpdated";
        public const string GroupMemberJoined = "GroupMemberJoined";
        public const string GroupMemberDeclined = "GroupMemberDeclined";
        public const string GroupMemberLeft = "GroupMemberLeft";
        public const string GroupMembersInvited = "GroupMembersInvited";
        public const string ParticipantAdded = "ParticipantAdded";
        public const string ParticipantRemoved = "ParticipantRemoved";
        
        // Typing indicators
        public const string UserTyping = "UserTyping";
        public const string UserStoppedTyping = "UserStoppedTyping";
        
        // Presence events
        public const string UserOnline = "UserOnline";
        public const string UserOffline = "UserOffline";
        
        // Sync events
        public const string SyncRequired = "SyncRequired";
    }

    /// <summary>
    /// Client-to-server metoder som klienten kan kalle.
    /// </summary>
    public static class ServerMethods
    {
        public const string Ping = "Ping";
        public const string GetConnectionInfo = "GetConnectionInfo";
        public const string StartTyping = "StartTyping";
        public const string StopTyping = "StopTyping";
        public const string JoinConversation = "JoinConversation";
        public const string LeaveConversation = "LeaveConversation";
    }

    /// <summary>
    /// SignalR gruppe-prefixes.
    /// </summary>
    public static class Groups
    {
        private const string UserPrefix = "user_";
        private const string ConversationPrefix = "conversation_";
        
        public static string ForUser(string userId) => $"{UserPrefix}{userId}";
        public static string ForConversation(int conversationId) => $"{ConversationPrefix}{conversationId}";
    }

    /// <summary>
    /// Query string parameter-navn for connection metadata.
    /// </summary>
    public static class QueryParams
    {
        public const string DeviceId = "deviceId";
        public const string Platform = "platform";
        public const string Capabilities = "capabilities";
        public const string AppVersion = "appVersion";
    }

    /// <summary>
    /// HTTP header-navn for connection metadata.
    /// </summary>
    public static class Headers
    {
        public const string UserAgent = "X-App-User-Agent";
        public const string DeviceInfo = "X-Device-Info";
    }

    /// <summary>
    /// Støttede plattformer.
    /// </summary>
    public static class Platforms
    {
        public const string Web = "web";
        public const string Ios = "ios";
        public const string Android = "android";
        public const string Desktop = "desktop";
    }
    
    // Redis key patterns
    public const string ConversationUsersKeyPattern = "conversation:{0}:active_users";
    public const string UserConversationsKeyPattern = "user:{0}:active_conversations";
}
