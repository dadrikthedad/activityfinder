namespace AFBack.Constants;

public static class SyncEventTypes 
{
    // Messages
    public const string NEW_MESSAGE = "NEW_MESSAGE";
    public const string MESSAGE_UPDATED = "MESSAGE_UPDATED";
    public const string MESSAGE_DELETED = "MESSAGE_DELETED";
    
    // Message Requests
    public const string MESSAGE_REQUEST_CREATED = "MESSAGE_REQUEST_CREATED";
    public const string MESSAGE_REQUEST_APPROVED = "MESSAGE_REQUEST_APPROVED";
    public const string MESSAGE_REQUEST_REJECTED = "MESSAGE_REQUEST_REJECTED";
    
    // Conversations  
    public const string CONVERSATION_CREATED = "CONVERSATION_CREATED";
    public const string CONVERSATION_UPDATED = "CONVERSATION_UPDATED";
    
    // Friends
    public const string FRIEND_ADDED = "FRIEND_ADDED";
    public const string FRIEND_REMOVED = "FRIEND_REMOVED";
    
    // Users
    public const string USER_BLOCKED = "USER_BLOCKED";
    public const string USER_UNBLOCKED = "USER_UNBLOCKED";
    public const string USER_ONLINE = "USER_ONLINE";
    public const string USER_OFFLINE = "USER_OFFLINE";
    
    // Real-time
    public const string TYPING_START = "TYPING_START";
    public const string TYPING_STOP = "TYPING_STOP";
}