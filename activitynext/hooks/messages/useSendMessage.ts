"use client";
import { useState, useEffect} from "react";
import { sendTextMessage } from "@/services/messages/messageService";
import { uploadMessageAttachments } from "@/services/files/fileService";
import { validateFiles } from "@/components/files/FileFunctions";
import {
  SendMessageRequestDTO,
  MessageDTO,
  MessageWithFilesData,
} from "@shared/types/MessageDTO";
import { useCurrentUser } from "@/store/useUserCacheStore";
import { useChatStore } from "@/store/useChatStore";

// ===================================
// 🏷️ TYPES & CONSTANTS
// ===================================

type SendMessagePayload = SendMessageRequestDTO | MessageWithFilesData;

const ERROR_MESSAGES = {
  NO_TEXT: "Meldingen må inneholde tekst",
  NO_CONTENT: "Meldingen må inneholde tekst eller minst ett vedlegg", 
  SEND_FAILED: "Kunne ikke sende melding",
  SEND_FILES_FAILED: "Kunne ikke sende melding med vedlegg",
  UNKNOWN_ERROR: "Noe gikk galt"
} as const;

// ===================================
// 🎯 TYPE GUARDS
// ===================================

function isFilePayload(payload: SendMessagePayload): payload is MessageWithFilesData {
  return 'files' in payload && Boolean(payload.files?.length);
}

// ===================================
// 🪝 MAIN HOOK
// ===================================


export function useSendMessage(onSuccess?: (message: MessageDTO) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  
  // Get current conversation ID from store
  const conversationId = useChatStore((state) => state.currentConversationId);

  // Reset error when conversation changes
  useEffect(() => {
    setError(null);
  }, [conversationId]);

  /**
   * 📤 Send melding (tekst og/eller filer)
   */
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

// ===================================
// 🔽 PRIVATE HELPER FUNCTIONS
// ===================================

/**
 * 💬 Send melding uten filer
 */
async function sendText(payload: SendMessageRequestDTO): Promise<MessageDTO> {
  const hasText = payload.text && payload.text.trim().length > 0;
  
  if (!hasText) {
    throw new Error(ERROR_MESSAGES.NO_TEXT);
  }

  const result = await sendTextMessage(payload);
  
  if (!result) {
    throw new Error(ERROR_MESSAGES.SEND_FAILED);
  }

  return result;
}

/**
 * 📎 Send melding med vedlegg
 */
async function sendWithFiles(payload: MessageWithFilesData): Promise<MessageDTO> {
  const hasText = payload.text && payload.text.trim().length > 0;
  const hasFiles = payload.files && payload.files.length > 0;

  if (!hasText && !hasFiles) {
    throw new Error(ERROR_MESSAGES.NO_CONTENT);
  }

  //  Type guard: Sikre at files finnes før validering
  if (!payload.files || payload.files.length === 0) {
    throw new Error("Ingen filer valgt");
  }

  //  Frontend-validering av filer
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

/**
 * 🛡️ Ekstraher feilmelding fra ukjent error
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      return parsed.details || parsed.message || err.message;
    } catch {
      return err.message;
    }
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}