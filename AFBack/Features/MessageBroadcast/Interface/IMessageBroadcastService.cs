using AFBack.Features.MessageBroadcast.DTO.cs;
using AFBack.Models;

namespace AFBack.Features.MessageBroadcast.Interface;

public interface IMessageBroadcastService
{
    void QueueNewMessageBackgroundTasks(int messageId, int conversationId, int userId, DateTime sentAt);
    Task ProcessMessageBroadcast(int messageId, int conversationId, int userId, DateTime sentAt);

    Task BroadcastSignalRAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,
        EncryptedMessageBroadcastResponse? response, int userId);

    Task BroadcastMessageNotificationsAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,
        EncryptedMessageBroadcastResponse? response, int userId, int conversationId);

    Task BroadcastSyncEventsAsync(Dictionary<int, ConversationStatus?> participantsWithStatus,
        EncryptedMessageBroadcastResponse? response, Conversation? conversation);

}