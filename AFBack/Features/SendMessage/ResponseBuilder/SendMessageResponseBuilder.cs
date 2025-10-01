using AFBack.Features.SendMessage.DTOs;
using AFBack.Features.SendMessage.Interface;
using AFBack.Models;

namespace AFBack.Features.SendMessage.ResponseBuilder;

public class SendMessageResponseBuilder : ISendMessageResponseBuilder
{   
    /// <summary>
    /// Bygger responsen for SendMessageAsync
    /// </summary>
    /// <param name="message"></param>
    /// <param name="attachments"></param>
    /// <returns></returns>
    /// <exception cref="InvalidOperationException"></exception>
    public SendMessageResponse BuildResponse(Message message, List<UploadedAttachment>? attachments)
    {
        // lager responsen som brukes uansett type melding
        var response = new SendMessageResponse
        {
            MessageId = message.Id,
            SentAt = message.SentAt,
            ConversationId = message.ConversationId,
        };
        
        // Hvis vi har med attachments så legger vi det til her
        if (message.Attachments.Count > 0 && attachments?.Count > 0)
        {
            if (message.Attachments.Count != attachments.Count)
                throw new InvalidOperationException(
                    $"Attachment count mismatch: message has {message.Attachments.Count} and attachments has {attachments.Count}");
            
            response.Attachments = message.Attachments
                .Select((dbAttachment, index) => new SendMessageAttachmentResponse
            {
                Id = dbAttachment.Id,
                OptimisticId = attachments[index].Attachment.OptimisticId,
                FileUrl = dbAttachment.EncryptedFileUrl,
                ThumbnailUrl = dbAttachment.EncryptedThumbnailUrl ?? string.Empty
            }).ToArray();
        }

        return response;
    }
}
