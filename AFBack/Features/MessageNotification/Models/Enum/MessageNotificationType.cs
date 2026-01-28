namespace AFBack.Features.MessageNotification.Models.Enum;

public enum MessageNotificationType
{
    NewMessage = 1,
    PendingMessageRequestReceived = 2,
    PendingConversationRequestApproved = 3,
    MessageReaction = 4,
    GroupRequest = 5,
    GroupRequestApproved = 6,
    GroupRequestInvited = 7, // For å la de andre brukerne vite om nye invitasjoner
    GroupEvent = 8,
    GroupDisbanded = 9,
}
