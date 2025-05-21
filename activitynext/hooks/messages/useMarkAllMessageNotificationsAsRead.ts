import { useState } from "react";
import { markAllMessageNotificationsAsRead } from "@/services/messages/messageNotificationService";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export function useMarkAllMessageNotificationsAsRead() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const markAllLocally = useMessageNotificationStore.getState().markAllAsRead;

  const markAllAsRead = async () => {
    setLoading(true);
    setError(null);

    try {
      await markAllMessageNotificationsAsRead();
      markAllLocally(); // ✅ oppdater Zustand
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  return { markAllAsRead, loading, error };
}