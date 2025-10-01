using AFBack.Features.MessageBroadcast.DTO.cs;

namespace AFBack.Interface.Repository;

public interface IMessageRepository
{
    Task<bool> MessageExists(int messageId);

    Task<EncryptedMessageBroadcastResponse?> GetAndMapMessageEncryptedMessage(int messageId);
}