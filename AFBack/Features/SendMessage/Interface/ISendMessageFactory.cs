using AFBack.Features.SendMessage.DTOs;
using AFBack.Models;

namespace AFBack.Features.SendMessage.Interface;

public interface ISendMessageFactory
{
    Message CreateMessage(SendMessageRequest request, int userId);

    List<MessageAttachment> CreateAttachments(List<UploadedAttachment> attachments, Message message);

    public Message CreateMessageWithAttachments(
        SendMessageRequest request,
        int userId,
        List<UploadedAttachment>? attachments);
}
