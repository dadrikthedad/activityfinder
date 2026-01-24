using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Request;

namespace AFBack.Features.Messaging.Interface;

public interface ISendMessageFactory
{
    public Models.Message CreateMessageWithAttachments(
        MessageRequest request,
        string userId,
        List<UploadedAttachmentDto>? attachments);
}
