namespace AFBack.Constants;

public static class SyncEventTypes 
{
    // Messages
    public const string NEW_MESSAGE = "NEW_MESSAGE"; // -- FERDIG FRONTEND TIL BACKEND! Systemmeldinger ferdig: ApprovedMessageRequest
    public const string MESSAGE_DELETED = "MESSAGE_DELETED"; // -- FERDIG FRONTEND TIL BACKEND!
    // Reactions
    public const string REACTION = "REACTION"; // -- FERDIG FRONTEND TIL BACKEND!
    // Message Requester
    public const string REQUEST_RECEIVED = "REQUEST_RECEIVED"; // Denne eventen er til de som mottar en gruppeforespørsel. Sender med hele conven -- FERDIG FRONTEND TIL BACKEND!
    // Conversations  
    public const string CONVERSATION_CREATED = "CONVERSATION_CREATED"; // Her sender vi med samtalen til den som har opprettet gruppen/samtalen eller godkjent samtalen, samt systemmelding. -- FERDIG BACKEND! 
    public const string CONVERSATION_RESTORED = "CONVERSATION_RESTORED"; // Sender med hele Conversation-objektet og legger den til i bakgrunn -- FERDIG FRONTEND TIL BACKEND
    // Group Events
    public const string CONVERSATION_LEFT = "CONVERSATION_LEFT"; // Brukes når vi forlater en gruppesamtale, avlslår en request eller den blir disbandet. Sender kun conversationId. Sletter den fra samtale listen -- FERDIG BACKEND OG FRONTEND!
    public const string GROUP_INFO_UPDATED = "GROUP_INFO_UPDATED"; // Brukes når noen har oppdatert gruppenavnet, gruppebilde, invitert noen eller noen har forlatt gruppen. Sender med hele samtalen og vi legger til eller oppdater samtalen hvis vi har akseptert, hvis samtalen er i pending så oppdateres gruppenavnet. -- FERDIG BACKEND TIL FRONTEND!
    // ---------------------------------- IKKE FERDIG -------------------------------- //
    
    // Friends
    public const string FRIEND_REQUEST_RECEIVED = "FRIEND_REQUEST_RECEIVED"; // Oppdaterer frontend med den nye venneforespørselen -- FERDIG BACKEND OG FRONTEND!
    public const string FRIEND_ADDED = "FRIEND_ADDED"; // Sender med hele UserSummary til begge brukerne av venneforespørselen og legger den til. Sletter også pending fra pendinglsiten hvis den er der -- FERDIG BACKEND OG FRONTEND!
    public const string FRIEND_REQUEST_DECLINED = "FRIEND_REQUEST_DECLINED"; // Sletter en venneforespørsel fra pending liSte. -- FERDIG BACKEND OG FRONTEND!
    public const string FRIEND_REMOVED = "FRIEND_REMOVED";
    
    // Users
    public const string USER_PROFILE_UPDATED = "USER_PROFILE_UPDATED"; // Brukes når en bruker oppdatere profilbilde eller navn, og sender med nødvendig informasjon for å oppdatere i store. -- FERDIGF BACKEND OG FRONTEND!
    public const string USER_BLOCKED_UPDATED = "USER_BLOCKED_UPDATED"; // Oppdaterer brukeren som hjar blitt blokkert eller har blokkert oss i USerSummary -- FERDIG BACKEND OG FRONTEND!!
    
    // Alle notificaitons er ferdig -- FERDIG FRONTEND TIL BACKEND!
    public const string MESSAGE_NOTIFICATION_CREATED = "MESSAGE_NOTIFICATION_CREATED";
    
    // Notifications til appen
    public const string NOTIFICATION_CREATED = "NOTIFICATION_CREATED";
}