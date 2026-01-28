using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotification.DTOs;
using AFBack.Features.MessageNotification.Models.Enum;

namespace AFBack.Features.MessageNotification.Service;

public interface IGroupNotificationService
{
    /// <summary>
    /// Oppretter eller oppdaterer GroupEvent-notifications for flere mottakere.
    /// Hvis bruker har en eksisterende ulest GroupEvent-notification for samme gruppe,
    /// legges den nye eventen til denne. Ellers opprettes en ny notification.
    /// </summary>
    /// <param name="recipientIds">Liste over brukere som skal motta notifikasjonen</param>
    /// <param name="triggeredByUser">Brukeren som utførte handlingen</param>
    /// <param name="conversationResponse">Gruppen hendelsen skjedde i</param>
    /// <param name="type">Type GroupEvent (MemberAccepted, MemberLeft, etc.)</param>
    /// <param name="summary">Tekst som beskriver hendelsen. Samme som systemmeldingen, f.eks.
    /// "Magnus joined the group"</param>
    /// <returns>Dictionary med recipientId som key og MessageNotificationResponse som
    /// value for SignalR/SyncEvent</returns>
    Task<Dictionary<string, MessageNotificationResponse>> CreateGroupNotificationEventAsync(
        List<string> recipientIds, UserSummaryDto triggeredByUser, ConversationResponse conversationResponse,
        GroupEventType type, string summary);
}
