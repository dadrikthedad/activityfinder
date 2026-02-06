namespace AFBack.Features.MessageNotification.Models.Enum;

public enum MessageNotificationType
{
    NewMessage = 1,
    PendingMessageRequestReceived = 2,
    PendingConversationRequestApproved = 3,
    MessageReaction = 4,
    GroupEvent = 5
}
