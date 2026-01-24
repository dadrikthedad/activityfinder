using AFBack.Features.Messaging.DTOs;
using AFBack.Features.Messaging.DTOs.Response;
using AFBack.Features.Messaging.Interface;

namespace AFBack.Features.Messaging.ResponseBuilder;

public class SendMessageResponseBuilder : ISendMessageResponseBuilder
{   
    /// <summary>
    /// Bygger responsen for SendMessageAsync
    /// </summary>
    /// <param name="message"></param>
    /// <param name="attachments"></param>
    /// <returns></returns>
    /// <exception cref="InvalidOperationException"></exception>
    public SendMessageResponse BuildResponse(Messaging.Models.Message message, List<UploadedAttachmentDto>? attachments)
    {
        // lager responsen som brukes uansett type melding
        var response = new SendMessageResponse
        {
            MessageId = message.Id,
            SentAt = message.SentAt
        };
        
        // Hvis vi har med attachments så legger vi det til her
        if (message.Attachments.Count > 0 && attachments?.Count > 0)
        {
            if (message.Attachments.Count != attachments.Count)
                throw new InvalidOperationException(
                    $"Attachment count mismatch: message has {message.Attachments.Count} " +
                    $"and attachments has {attachments.Count}");
            
            response.Attachments = message.Attachments
                .Select((dbAttachment, index) => new AttachmentResponse
            {
                Id = dbAttachment.Id,
                OptimisticId = attachments[index].AttachmentRequest.OptimisticId,
                FileUrl = dbAttachment.EncryptedFileUrl,
                ThumbnailUrl = dbAttachment.EncryptedThumbnailUrl ?? string.Empty
            }).ToArray();
        }

        return response;
    }
}
