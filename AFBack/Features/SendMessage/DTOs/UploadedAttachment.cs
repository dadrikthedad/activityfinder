namespace AFBack.Features.SendMessage.DTOs;

public class UploadedAttachment
{
    public string EncryptedFileUrl { get; set; }
    public string EncryptedThumbnailUrl { get; set; }
    public SendMessageAttachment Attachment { get; set; }
}
