import { useState } from "react";
import { markAllMessageNotificationsAsRead } from "@/services/messages/messageNotificationService";

export function useMarkAllMessageNotificationsAsRead() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markAllAsRead = async (onSuccess?: () => void) => {
    setLoading(true);
    setError(null);

    try {
      await markAllMessageNotificationsAsRead();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  return { markAllAsRead, loading, error };
}