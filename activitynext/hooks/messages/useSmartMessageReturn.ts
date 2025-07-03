// hooks/useSmartMessage.ts
import { useState, useCallback } from 'react';
import { MessageDTO, MessageWithFilesData } from '@/types/MessageDTO';
import { sendTextMessage } from '@/services/messages/messageService';
import { uploadMessageAttachments } from '@/services/files/fileService';
import { validateFiles } from '@/services/files/fileServiceHelperFunctions';

interface UseSmartMessageReturn {
  sendMessage: (data: MessageWithFilesData) => Promise<MessageDTO | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  lastSentMessage: MessageDTO | null;
}

interface UseSmartMessageReturn {
  sendMessage: (data: MessageWithFilesData) => Promise<MessageDTO | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  lastSentMessage: MessageDTO | null;
}

export const useSmartMessage = (): UseSmartMessageReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentMessage, setLastSentMessage] = useState<MessageDTO | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (data: MessageWithFilesData): Promise<MessageDTO | null> => {
    const hasFiles = data.files && data.files.length > 0;
    const hasText = data.text && data.text.trim().length > 0;

    // Reset state
    setError(null);
    setIsLoading(true);

    try {
      // Validér at det finnes innhold
      if (!hasText && !hasFiles) {
        throw new Error("Meldingen må inneholde tekst eller minst ett vedlegg");
      }

      let result: MessageDTO | null = null;

      if (hasFiles) {
        // Validér filer først
        const validation = validateFiles(data.files!);
        if (!validation.isValid) {
          throw new Error(validation.error || "Ugyldig fil");
        }

        // Send med filer via FileController
        result = await uploadMessageAttachments({
          text: data.text,
          files: data.files!,
          conversationId: data.conversationId,
          receiverId: data.receiverId,
          parentMessageId: data.parentMessageId,
        });
      } else {
        // Send kun tekst via MessageController
        result = await sendTextMessage({
          text: data.text,
          conversationId: data.conversationId,
          receiverId: data.receiverId,
          parentMessageId: data.parentMessageId,
        });
      }

      setLastSentMessage(result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ukjent feil oppstod';
      setError(errorMessage);
      throw err; // Re-throw så komponenten kan håndtere det
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    clearError,
    lastSentMessage
  };
};

// 🆕 Alternativ hook med mer avanserte features
export const useAdvancedSmartMessage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<MessageDTO[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (
    data: MessageWithFilesData,
    options?: {
      onProgress?: (progress: number) => void;
      optimisticUpdate?: boolean;
    }
  ): Promise<MessageDTO | null> => {
    const hasFiles = data.files && data.files.length > 0;
    const hasText = data.text && data.text.trim().length > 0;

    setError(null);
    setIsLoading(true);
    setUploadProgress(0);

    try {
      if (!hasText && !hasFiles) {
        throw new Error("Meldingen må inneholde tekst eller minst ett vedlegg");
      }

      // Optimistic update (legg til melding midlertidig)
      if (options?.optimisticUpdate) {
        const optimisticMessage: MessageDTO = {
          id: Date.now(), // Temp ID
          senderId: null, // Will be set by server
          text: data.text || null,
          sentAt: new Date().toISOString(),
          conversationId: data.conversationId,
          attachments: [], // Will be populated after upload
          reactions: [],
          isSystemMessage: false,
          parentMessageId: data.parentMessageId || null,
        };
        setSentMessages(prev => [...prev, optimisticMessage]);
      }

      let result: MessageDTO | null = null;

      if (hasFiles) {
        const validation = validateFiles(data.files!);
        if (!validation.isValid) {
          throw new Error(validation.error || "Ugyldig fil");
        }

        // Simulate progress for file uploads
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const newProgress = prev + 10;
            options?.onProgress?.(newProgress);
            return Math.min(newProgress, 90);
          });
        }, 100);

        try {
          result = await uploadMessageAttachments({
            text: data.text,
            files: data.files!,
            conversationId: data.conversationId,
            receiverId: data.receiverId,
            parentMessageId: data.parentMessageId,
          });
        } finally {
          clearInterval(progressInterval);
          setUploadProgress(100);
        }
      } else {
        result = await sendTextMessage({
          text: data.text,
          conversationId: data.conversationId,
          receiverId: data.receiverId,
          parentMessageId: data.parentMessageId,
        });
      }

      if (result) {
        setSentMessages(prev => {
          // Replace optimistic message with real one, or just add if no optimistic
          if (options?.optimisticUpdate) {
            return prev.map(msg => 
              msg.id === Date.now() ? result! : msg
            );
          }
          return [...prev, result!];
        });
      }

      return result;

    } catch (err) {
      // Remove optimistic message on error
      if (options?.optimisticUpdate) {
        setSentMessages(prev => prev.filter(msg => msg.id !== Date.now()));
      }

      const errorMessage = err instanceof Error ? err.message : 'Ukjent feil oppstod';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    clearError,
    sentMessages,
    uploadProgress
  };
};