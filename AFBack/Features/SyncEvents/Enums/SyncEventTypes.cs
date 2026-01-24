namespace AFBack.Features.SyncEvents.Enums;

public enum SyncEventType
{
    
    // TODO: Ferdig ------------------------------------------------------------------------------
    
    // ==================== Messages ====================
    
    /// <summary>
    /// Ny melding mottatt i samtale
    /// EventData: { ConversationResponse, MessageResponse }
    /// </summary>
    NewMessage,
    
    // TODO: IkkeFerdig ------------------------------------------------------------------------------
    
    /// <summary>
    /// Melding slettet fra samtale
    /// EventData: { ConversationId, MessageId }
    /// </summary>
    MessageDeleted,
    
    // ==================== Reactions ====================
    
    /// <summary>
    /// Reaksjon lagt til/fjernet på melding
    /// EventData: { MessageId, Emoji, UserId }
    /// </summary>
    Reaction,
    
    // ==================== Message Requests ====================
    
    /// <summary>
    /// Mottatt ny message request
    /// EventData: { ConversationResponse }
    /// </summary>
    RequestReceived,
    
    // ==================== Conversations ====================
    
    /// <summary>
    /// Samtale opprettet (TODO: eller godkjent)
    /// EventData: { sendMessageToUserResponse }
    /// </summary>
    ConversationCreated,
    
    /// <summary>
    /// Pending Conversation Mottatt
    /// EventData: { sendMessageToUserResponse }
    /// </summary>
    PendingConversationCreated,
    
    /// <summary>
    /// Samtale gjenopprettet
    /// EventData: { ConversationResponse }
    /// </summary>
    ConversationRestored,
    
    /// <summary>
    /// Forlatt/avslått gruppesamtale
    /// EventData: { ConversationId }
    /// </summary>
    ConversationLeft,
    
    /// <summary>
    /// Gruppeinfo oppdatert (navn, bilde, medlemmer)
    /// EventData: { ConversationResponse }
    /// </summary>
    GroupInfoUpdated,
    
    /// <summary>
    /// Samtaler som har blitt arkivert på en enhet. Fjernes da fra de andre
    /// EventData: { conversatioinId }
    /// </summary>
    ConversationArchived,
    
    // ==================== Friends ====================
    
    /// <summary>
    /// Mottatt ny venneforespørsel
    /// EventData: { FriendRequest }
    /// </summary>
    FriendRequestReceived,
    
    /// <summary>
    /// Venneforespørsel godkjent
    /// EventData: { UserSummary }
    /// </summary>
    FriendAdded,
    
    /// <summary>
    /// Venneforespørsel avslått
    /// EventData: { FriendRequestId }
    /// </summary>
    FriendRequestDeclined,
    
    /// <summary>
    /// Venn fjernet
    /// EventData: { UserId }
    /// </summary>
    FriendRemoved,
    
    // ==================== User Profile ====================
    
    /// <summary>
    /// Brukerprofil oppdatert (navn, bilde)
    /// EventData: { UserSummary }
    /// </summary>
    UserProfileUpdated,
    
    /// <summary>
    /// Blokkeringsstatus endret
    /// EventData: { UserId, IsBlocked }
    /// </summary>
    UserBlockedUpdated,
    
    // ==================== Notifications ====================
    
    /// <summary>
    /// Ny meldings-notifikasjon opprettet
    /// EventData: { MessageNotificationResponse }
    /// </summary>
    MessageNotificationCreated,
    
    /// <summary>
    /// Notifikasjon(er) markert som lest
    /// EventData: { NotificationIds }
    /// </summary>
    MarkAsRead,
    
    /// <summary>
    /// Alle notifikasjoner markert som lest
    /// EventData: { } (tom)
    /// </summary>
    MarkAllAsRead,
    
    /// <summary>
    /// Ny app-notifikasjon opprettet
    /// EventData: { NotificationResponse }
    /// </summary>
    NotificationCreated
}
