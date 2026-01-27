namespace AFBack.Features.SyncEvents.Enums;

public enum SyncEventType
{
    
    // TODO: Ferdig ------------------------------------------------------------------------------
    
    // ==================== Messages ====================
    
    /// <summary>
    /// Ny melding mottatt i samtale
    /// EventData: { ConversationResponse, MessageResponse }
    /// Hvorfor: ConversationResponse for å oppdatere lastMessageSentAt i samtalelisten.
    /// MessageResponse for å legge meldingen til i meldingslisten for samtalen.
    /// </summary>
    NewMessage,
    
    // ==================== Conversations ====================
    
    /// <summary>
    /// Samtale opprettet
    /// EventData: { sendMessageToUserResponse }
    /// Hvorfor: SendMessageToUserResponse inneholder både ConversationResponse
    /// (for å legge samtalen i samtalelisten) og MessageResponse (for å vise første melding).
    /// </summary>
    ConversationCreated,
    
    /// <summary>
    /// Pending Conversation Mottatt
    /// EventData: { sendMessageToUserResponse }
    /// Hvorfor: SendMessageToUserResponse inneholder både ConversationResponse
    /// (for å legge pending requesten i pending-listen) og MessageResponse (for å vise første melding i preview).
    /// </summary>
    PendingConversationCreated,
    
    /// <summary>
    /// Pending Conversation Request bruker har sendt ble akseptert 
    /// EventData: { conversationResponse }
    /// Hvorfor: ConversationResponse for å oppdatere samtalen i samtalelisten fra PendingRequest til DirectChat.
    /// Flytter samtalen fra "sent requests" til aktive samtaler.
    /// </summary>
    ConversationAccepted,
    
    /// <summary>
    /// Brukeren har akseptert Pending Conversation Request de har mottatt
    /// EventData: { conversationResponse }
    /// Hvorfor: ConversationResponse for å oppdatere samtalen i samtalelisten fra PendingRequest til DirectChat.
    /// Flytter samtalen fra "pending" til aktive samtaler.
    /// </summary>
    ConversationRequestAccepted,
    
    /// <summary>
    /// Pending Conversation Request avslått
    /// EventData: { conversationId }
    /// Hvorfor: ConversationId for å fjerne samtalen fra pending-listen. Sender får IKKE beskjed (privacy).
    /// </summary>
    ConversationRejected,
    
    /// <summary>
    /// Samtale gjenopprettet
    /// EventData: { ConversationResponse }
    /// Hvorfor: ConversationResponse for å legge samtalen tilbake i samtalelisten fra arkiv.
    /// </summary>
    ConversationRestored,
    
    
    /// <summary>
    /// Samtaler som har blitt arkivert på en enhet. Fjernes da fra de andre
    /// EventData: { conversationId }
    /// Hvorfor: ConversationId for å fjerne samtalen fra samtalelisten på andre enheter.
    /// Arkivering synkroniseres på tvers av enheter.
    /// </summary>
    ConversationArchived,
    
    
    // ==================== Group Conversations ====================
    
    /// <summary>
    /// Pending Conversation Mottatt for gruppesamtaler
    /// EventData: { CreateGroupConversationResponse }
    /// Hvorfor: CreateGroupConversationResponse inneholder både ConversationResponse
    /// (for å legge pending requesten i pending-listen) og MessageResponse (for å vise første melding i preview).
    /// </summary>
    GroupInviteReceived,
    
    /// <summary>
    /// Bruker aksepterte gruppeinvitasjon - sendes til alle andre med Accepted status
    /// EventData: { ConversationResponse }
    /// Hvorfor: ConversationResponse for å oppdatere participant-listen i samtalen.
    /// Viser at en ny bruker har blitt med i gruppen.
    /// </summary>
    GroupInviteAccepted,
    
    /// <summary>
    /// Brukerens egen accept av gruppeinvitasjon - sendes kun til brukerens andre enheter
    /// EventData: { ConversationResponse }
    /// Hvorfor: ConversationResponse for å flytte samtalen fra pending til aktive samtaler på andre enheter.
    /// </summary>
    GroupInviteAcceptedByMe,
    
    /// <summary>
    /// Bruker avviste gruppeinvitasjon - sendes til alle andre med Accepted status
    /// EventData: { ConversationResponse }
    /// Hvorfor: ConversationResponse for å oppdatere participant-listen i samtalen.
    /// Fjerner brukeren fra pending-listen og viser at invitasjonen ble avvist.
    /// </summary>
    GroupInviteDeclined,
    
    /// <summary>
    /// Bruker forlot gruppesamtalen - sendes til alle gjenstående medlemmer med Accepted status
    /// EventData: { ConversationResponse }
    /// Hvorfor: ConversationResponse for å oppdatere participant-listen i samtalen.
    /// Fjerner brukeren fra medlemslisten.
    /// </summary>
    GroupMemberLeft,
    
    // TODO: IkkeFerdig ------------------------------------------------------------------------------
    
    /// <summary>
    /// Melding slettet fra samtale
    /// EventData: { ConversationId, MessageId }
    /// Hvorfor: Må fylles ut
    /// </summary>
    MessageDeleted,
    
    // ==================== Reactions ====================
    
    /// <summary>
    /// Reaksjon lagt til/fjernet på melding
    /// EventData: { MessageId, Emoji, UserId }
    /// Hvorfor: Må fylles ut
    /// </summary>
    Reaction,
    
    
    
    /// <summary>
    /// Forlatt/avslått gruppesamtale
    /// EventData: { ConversationId }
    /// Hvorfor: Må fylles ut
    /// </summary>
    ConversationLeft,
    
    /// <summary>
    /// Gruppeinfo oppdatert (navn, bilde, medlemmer)
    /// EventData: { ConversationResponse }
    /// Hvorfor: Må fylles ut
    /// </summary>
    GroupInfoUpdated,
    
    
    // ==================== Friends ====================
    
    /// <summary>
    /// Mottatt ny venneforespørsel
    /// EventData: { FriendRequest }
    /// Hvorfor: Må fylles ut
    /// </summary>
    FriendRequestReceived,
    
    /// <summary>
    /// Venneforespørsel godkjent
    /// EventData: { UserSummary }
    /// Hvorfor: Må fylles ut
    /// </summary>
    FriendAdded,
    
    /// <summary>
    /// Venneforespørsel avslått
    /// EventData: { FriendRequestId }
    /// Hvorfor: Må fylles ut
    /// </summary>
    FriendRequestDeclined,
    
    /// <summary>
    /// Venn fjernet
    /// EventData: { UserId }
    /// Hvorfor: Må fylles ut
    /// </summary>
    FriendRemoved,
    
    // ==================== User Profile ====================
    
    /// <summary>
    /// Brukerprofil oppdatert (navn, bilde)
    /// EventData: { UserSummary }
    /// Hvorfor: Må fylles ut
    /// </summary>
    UserProfileUpdated,
    
    /// <summary>
    /// Blokkeringsstatus endret
    /// EventData: { UserId, IsBlocked }
    /// Hvorfor: Må fylles ut
    /// </summary>
    UserBlockedUpdated,
    
    // ==================== Notifications ====================
    
    /// <summary>
    /// Ny meldings-notifikasjon opprettet
    /// EventData: { MessageNotificationResponse }
    /// Hvorfor: MessageNotificationResponse for å legge notifikasjonen direkte inn i notification-feeden.
    /// Inneholder all nødvendig info (avsender, preview, count, etc.).
    /// </summary>
    MessageNotificationCreated,
    
    /// <summary>
    /// Notifikasjon(er) markert som lest
    /// EventData: { NotificationIds }
    /// Hvorfor: Må fylles ut
    /// </summary>
    MarkAsRead,
    
    /// <summary>
    /// Alle notifikasjoner markert som lest
    /// EventData: { } (tom)
    /// Hvorfor: Må fylles ut
    /// </summary>
    MarkAllAsRead,
    
    /// <summary>
    /// Ny app-notifikasjon opprettet
    /// EventData: { NotificationResponse }
    /// Hvorfor: Må fylles ut
    /// </summary>
    NotificationCreated
}
