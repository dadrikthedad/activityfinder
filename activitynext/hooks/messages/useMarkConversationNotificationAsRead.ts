import { useState } from "react";
import { markConversationNotificationsAsRead } from "@/services/messages/messageNotificationService";
import { useChatStore } from "@/store/useChatStore";

export function useMarkConversationNotificationsAsRead() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const markLocally = useChatStore(state => state.markConversationAsReadLocally);

  const markAsReadForConversation = async (
    conversationId: number,
    onSuccess?: () => void
  ) => {
    if (!conversationId || conversationId <= 0) return;

    setLoading(true);
    try {
      await markConversationNotificationsAsRead(conversationId);
      markLocally(conversationId);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  return {
    markAsReadForConversation,
    loading,
    error,
  };
}
