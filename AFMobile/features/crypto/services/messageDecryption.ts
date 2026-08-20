// features/crypto/services/messageDecryption.ts
// Dekrypterer og mapper en liste krypterte backend-meldinger (EncryptedMessageDTO,
// strukturelt lik backend MessageResponse) til ferdige MessageDTO med klartekst.
//
// Ren service (ingen React-hooks) slik at den kan kalles fra conversationService og
// andre util-funksjoner. Speiler mappingen i useBootstrapMessageDecryption — vedlegg
// dekrypteres lazy (kun metadata beholdes her).

import { MessageDTO, AttachmentDto } from "@shared/types/MessageDTO";
import { EncryptedMessageDTO } from "@/features/crypto/types/EncryptedMessageTypes";
import { EncryptMessageService } from "./EncryptMessageService";

function mapLazyAttachments(enc: EncryptedMessageDTO): AttachmentDto[] {
  return (enc.encryptedAttachments ?? []).map((att) => ({
    fileUrl: att.encryptedFileUrl,
    fileType: att.fileType,
    fileName: att.fileName,
    fileSize: att.fileSize,
    isEncrypted: true,
    needsDecryption: true,
    keyInfo: att.keyInfo,
    iv: att.iv,
    version: att.version ?? 1,
    thumbnailUrl: att.encryptedThumbnailUrl,
    thumbnailWidth: att.thumbnailWidth,
    thumbnailHeight: att.thumbnailHeight,
    thumbnailKeyInfo: att.thumbnailKeyInfo ?? undefined,
    thumbnailIV: att.thumbnailIV,
  }));
}

function toMessageDto(enc: EncryptedMessageDTO, text: string | null): MessageDTO {
  return {
    id: enc.id,
    senderId: enc.senderId,
    text,
    sentAt: enc.sentAt,
    conversationId: enc.conversationId,
    attachments: mapLazyAttachments(enc),
    reactions: enc.reactions ?? [],
    parentMessageId: enc.parentMessageId,
    parentMessageText: enc.parentMessagePreview,
    parentSender: enc.parentSender,
    sender: enc.sender,
    isRejectedRequest: enc.isRejectedRequest,
    isNowApproved: enc.isNowApproved,
    isSilent: enc.isSilent,
    isSystemMessage: enc.isSystemMessage,
    isDeleted: enc.isDeleted,
  };
}

/**
 * Dekrypterer alle meldinger parallelt og returnerer MessageDTO[] i samme rekkefølge.
 * Tekst-only/system-meldinger (uten encryptedText) får text = null.
 * Meldinger som feiler dekryptering får en synlig feil-markør i text.
 */
export async function decryptMessagesToDto(
  encryptedMessages: EncryptedMessageDTO[],
): Promise<MessageDTO[]> {
  const service = EncryptMessageService.getInstance();

  const decrypted = await Promise.all(
    encryptedMessages.map(async (enc) => {
      const hasEncryptedText = !!enc.keyInfo && !!enc.encryptedText && enc.encryptedText !== "";
      if (!hasEncryptedText) {
        // Vedlegg-only / systemmelding — ingen tekst å dekryptere
        return toMessageDto(enc, null);
      }

      try {
        const text = await service.decryptMessage({
          encryptedText: enc.encryptedText,
          keyInfo: enc.keyInfo,
          iv: enc.iv,
          version: enc.version ?? 1,
        });
        return toMessageDto(enc, text ?? "🔐 Failed to decrypt message");
      } catch {
        return toMessageDto(enc, "🔐 Failed to decrypt message");
      }
    }),
  );

  return decrypted;
}
