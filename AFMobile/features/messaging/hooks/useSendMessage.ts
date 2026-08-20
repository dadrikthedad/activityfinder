// hooks/messages/useSendMessage.ts
import { useState } from "react";
import { sendTextMessage } from "@/services/messages/messageService";
import { uploadMessageAttachments } from "@/services/files/fileService";
import { validateFiles } from "@/utils/files/FileFunctions";
import {
  SendMessageRequestDTO,
  MessageDTO,
} from "@shared/types/MessageDTO";
import { useCurrentUser } from "@/store/useUserCacheStore";
import { useChatStore } from "@/store/useChatStore";
import { RNFile } from "@/utils/files/FileFunctions";
import { extractErrorMessage } from "@/utils/messages/extractErrorMessage";

// Native-specific DTO for React Native file messages
interface MessageWithFilesNative {
  text?: string;
  files?: RNFile[];
  conversationId: number;
  receiverId?: string;
  parentMessageId?: number | null;
}

type SendMessagePayload = SendMessageRequestDTO | MessageWithFilesNative;

const ERROR_MESSAGES = {
  NO_TEXT: "Meldingen må inneholde tekst",
  NO_CONTENT: "Meldingen må inneholde tekst eller minst ett vedlegg",
  SEND_FAILED: "Kunne ikke sende melding",
  SEND_FILES_FAILED: "Kunne ikke sende melding med vedlegg",
} as const;

function isFilePayload(payload: SendMessagePayload): payload is MessageWithFilesNative {
  return 'files' in payload && Boolean(payload.files?.length);
}

export function useSendMessage(onSuccess?: (message: MessageDTO) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const conversationId = useChatStore((state) => state.currentConversationId);

  const send = async (payload: SendMessagePayload) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = isFilePayload(payload)
        ? await sendWithFiles(payload)
        : await sendText(payload);

      if (result) {
        const enriched: MessageDTO = {
          ...result,
          sender: user,
        };

        // Hvis det er en melding med filer, registrer mapping for vedlegg
        if (isFilePayload(payload) && result.attachments && result.attachments.length > 0 && conversationId !== null) {
          const store = useChatStore.getState();
          const allMessages = [
            ...(store.cachedMessages[conversationId] || []),
            ...(store.liveMessages[conversationId] || [])
          ];

          // Finn optimistisk melding basert på matching (tekst, sender, tid)
          const optimisticMessage = allMessages.find(msg =>
            msg.isOptimistic &&
            msg.text === result.text &&
            msg.senderId === result.senderId &&
            Math.abs(new Date(msg.sentAt).getTime() - new Date(result.sentAt).getTime()) < 10000
          );

          if (optimisticMessage?.optimisticId) {
            // Registrer message mapping først
            store.registerOptimisticMapping(optimisticMessage.optimisticId, result.id);

            // Registrer attachment mappings
            if (optimisticMessage.attachments && result.attachments.length > 0) {
              result.attachments.forEach((serverAttachment, index) => {
                const optimisticAttachment = optimisticMessage.attachments[index];
                if (optimisticAttachment?.isOptimistic && optimisticAttachment.optimisticId) {
                  store.registerOptimisticAttachmentMapping(
                    optimisticAttachment.optimisticId,
                    serverAttachment.fileUrl
                  );
                }
              });
            }
          }
        }

        onSuccess?.(enriched);
        return enriched;
      }

      return null;
    } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err);
      console.error("❌ Feil ved sending av melding:", errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { send, loading, error };
}

async function sendText(payload: SendMessageRequestDTO): Promise<MessageDTO> {
  if (!payload.text || payload.text.trim().length === 0) {
    throw new Error(ERROR_MESSAGES.NO_TEXT);
  }

  const result = await sendTextMessage(payload);

  if (!result) {
    throw new Error(ERROR_MESSAGES.SEND_FAILED);
  }

  return result;
}

async function sendWithFiles(payload: MessageWithFilesNative): Promise<MessageDTO> {
  const hasText = payload.text && payload.text.trim().length > 0;
  const hasFiles = payload.files && payload.files.length > 0;

  if (!hasText && !hasFiles) {
    throw new Error(ERROR_MESSAGES.NO_CONTENT);
  }

  if (!payload.files || payload.files.length === 0) {
    throw new Error("Ingen filer valgt");
  }

  if (!payload.conversationId) {
    throw new Error("conversationId er påkrevd for fil-opplasting");
  }

  const validation = validateFiles(payload.files);
  if (!validation.isValid) {
    throw new Error(validation.error || "Ugyldig fil");
  }

  const result = await uploadMessageAttachments({
    text: payload.text,
    files: payload.files,
    conversationId: payload.conversationId,
    receiverId: payload.receiverId,
    parentMessageId: payload.parentMessageId,
  });

  if (!result) {
    throw new Error(ERROR_MESSAGES.SEND_FILES_FAILED);
  }

  return result;
}
