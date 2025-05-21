import { useState } from "react";
import { markMessageNotificationAsRead } from "@/services/messages/messageNotificationService";
import { useChatStore } from "@/store/useChatStore";

export function useMessageMarkNotificationAsRead() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markAsRead = async (notificationId: number, onSuccess?: () => void) => {
    setLoading(true);
    setError(null);

    try {
      await markMessageNotificationAsRead(notificationId);

      // 🔁 Oppdater Zustand lokalt
      const { messageNotifications, setMessageNotifications } = useChatStore.getState();

      const updated = messageNotifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      );

      setMessageNotifications(updated);

      if (onSuccess) onSuccess(); // f.eks. navigate, oppdater UI
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  return { markAsRead, loading, error };
}