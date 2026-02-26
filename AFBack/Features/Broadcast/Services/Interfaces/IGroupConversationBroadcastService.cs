using AFBack.Common.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.Models.Enum;

namespace AFBack.Features.Broadcast.Services.Interfaces;

public interface IGroupConversationBroadcastService
{
    /// <summary>
    /// Broadcaster at en bruker aksepterte en gruppeinvitasjon.
    /// Sender til: aksepterende bruker (sync), andre medlemmer (SignalR + notification + sync)
    /// </summary>
    /// <param name="joiningUserId">Brukeren som har akseptert forespørselen</param>
    /// <param name="otherAcceptedMemberIds">Andre brukere som har godkjent</param>
    /// <param name="response">ConversationResponse for å oppdatere samtalen</param>
    /// <param name="summary">Summary for notifikasjonen</param>
    /// <param name="joiningUserSummaryDto">DTO-en til den som godtok for notifikasjon</param>
    Task BroadcastGroupInviteAcceptedAsync(string joiningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto joiningUserSummaryDto);
    
    /// <summary>
    /// Broadcaster at en bruker avviste en gruppeinvitasjon.
    /// Sender til: avvisende bruker (sync), andre medlemmer (SignalR + sync)
    /// </summary>
    /// <param name="decliningUserId">Brukeren som har avslått forespørselen</param>
    /// <param name="otherAcceptedMemberIds">Andre brukere som har godkjent</param>
    /// <param name="response">ConversationResponse for å oppdatere samtalen.
    /// Kun ID trengs til syncevent for decliningUserId</param>
    /// <param name="summary">Summary for notifikasjonen</param>
    /// <param name="decliningUserSummaryDto">DTO-en til den som avslå forespørselen</param>
    Task BroadcastGroupInviteDeclinedAsync(string decliningUserId, List<string> otherAcceptedMemberIds,
        ConversationResponse response, string summary, UserSummaryDto decliningUserSummaryDto);
    
    /// <summary>
    /// Broadcaster at en bruker forlot en gruppe.
    /// Sender til: brukeren som forlot (sync), gjenværende medlemmer (SignalR + sync)
    /// </summary>
    /// <param name="leavingUserId">Brukeren som har forlatt samtalen</param>
    /// <param name="remainingMemberIds">Andre brukere som har godkjent</param>
    /// <param name="response">ConversationResponse for å oppdatere samtalen.
    /// Kun ID trengs til syncevent for leavingUserId</param>
    /// <param name="summary">Summary for notifikasjonen</param>
    /// <param name="leavingUserSummaryDto">DTO-en til den som forlot gruppen</param>
    Task BroadcastGroupMemberLeftAsync(string leavingUserId, List<string> remainingMemberIds, 
        ConversationResponse response, string summary, UserSummaryDto leavingUserSummaryDto);
    
    /// <summary>
    /// Broadcaster at nye brukere ble invitert til en gruppe.
    /// Sender til: inviterende bruker (sync), eksisterende medlemmer (SignalR + sync), inviterte
    /// (SignalR + notification + sync)
    /// </summary>
    /// <param name="inviterUserId">Brukeren som inviterte</param>
    /// <param name="invitedUserIds">De inviterte brukerne</param>
    /// <param name="otherAcceptedMemberIds">Medlemmer av samtalen som har akseptert</param>
    /// <param name="response">ConversationResponse for å oppdatere samtalen</param>
    /// <param name="summary">Summary for notifikasjonen</param>
    /// <param name="inviterUserSummaryDto">DTO-en til brukern som inviterte</param>

    Task BroadcastGroupInvitesSentAsync(string inviterUserId, List<string> invitedUserIds,
        List<string> otherAcceptedMemberIds, ConversationResponse response, string summary,
        UserSummaryDto inviterUserSummaryDto);
    
    /// <summary>
    /// Broadcaster at gruppeinformasjon ble oppdatert (navn, bilde, etc).
    /// Sender til: brukeren som oppdaterte (sync), andre deltakere (SignalR + sync)
    /// </summary>
    /// <param name="updaterUserId">Brukeren som har utført en oppdatering. Feks oppdatert bilde</param>
    /// <param name="otherParticipantIds">Alle ConversationParticipants</param>
    /// <param name="response">ConversationResponse for å oppdatere samtalen</param>
    /// <param name="summary">Summary for notifikasjonen</param>
    /// <param name="updaterUserSummaryDto">DTO-en til den som oppdaterte samtalen</param>
    /// <param name="eventType">Type hendelse utført</param>
    Task BroadcastGroupInfoUpdatedAsync(string updaterUserId, List<string> otherParticipantIds,
        ConversationResponse response, string summary, UserSummaryDto updaterUserSummaryDto, GroupEventType eventType);
}
