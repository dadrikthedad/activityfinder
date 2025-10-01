using AFBack.Features.SendMessage.DTOs;
using AFBack.Models;

namespace AFBack.Features.SendMessage.Interface;

public interface ISendMessageValidator
{
    Task ValidateSendMessageAsync(SendMessageRequest request, int userId);
    void ValidateUserParticipants(Conversation conversation, int userId);

    Task ValidateParentMessageExists(int parentMessageId);
    Task ValidateOneOnOneConversation(Conversation conversation, int userId);
}