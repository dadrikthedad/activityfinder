import { useState } from "react";
import {
  markMessageNotificationAsRead,
  markAllMessageNotificationsAsRead,
} from "@/services/messages/messageNotificationService";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export function useMessageNotificationActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { markAsRead: updateLocalRead, markAllAsRead: updateLocalAllRead } =
    useMessageNotificationStore.getState();

  const markOneAsRead = async (notificationId: number) => {
    setLoading(true);
    setError(null);

    try {
      await markMessageNotificationAsRead(notificationId);
      updateLocalRead(notificationId); // ✅ Zustand
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    setError(null);

    try {
      await markAllMessageNotificationsAsRead();
      updateLocalAllRead(); // ✅ Zustand
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  return {
    markOneAsRead,
    markAllAsRead,
    loading,
    error,
  };
}
