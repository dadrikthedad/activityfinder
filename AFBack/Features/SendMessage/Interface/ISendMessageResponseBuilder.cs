using AFBack.Features.SendMessage.DTOs;
using AFBack.Models;

namespace AFBack.Features.SendMessage.Interface;

public interface ISendMessageResponseBuilder
{
    SendMessageResponse BuildResponse(Message message, List<UploadedAttachment>? attachments);
}
