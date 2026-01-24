using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Response;

namespace AFBack.Features.Messaging.Interface;

public interface ISendMessageResponseBuilder
{
    SendMessageResponse BuildResponse(Messaging.Models.Message message, List<UploadedAttachmentDto>? attachments);
}
