// hooks/messages/useSoftDelete.ts
import { useState } from "react";
import { deleteMessage as apiDeleteMessage } from "@/services/messages/messageService";
import { MessageDTO } from "@shared/types/MessageDTO";

interface UseDeleteMessageOptions {
  onSuccess?: (deletedMessage: MessageDTO) => void;
  onError?: (error: Error) => void;
}

export function useDeleteMessage(options: UseDeleteMessageOptions = {}) {
  const { onSuccess, onError } = options;
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMessage = async (message: MessageDTO) => {
    try {
      setIsDeleting(true);

      const deletedMessage = await apiDeleteMessage(message.id);

      console.log('Message deleted successfully:', message.id);
      onSuccess?.(deletedMessage || message);

    } catch (error) {
      console.error('Failed to delete message:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to delete message'));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteMessage,
    isDeleting,
  };
}
