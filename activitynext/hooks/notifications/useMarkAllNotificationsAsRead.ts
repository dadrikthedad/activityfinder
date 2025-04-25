// Her markerer vi at alle notificaitons har blitt lest ved å fetche fra backend
import { useAuth } from "@/context/AuthContext";
import { markAllNotificationsAsRead } from "@/services/notifications/markAllNotificationsAsRead";
import { useCallback, useState } from "react";

export function useMarkAllNotificationsAsRead() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await markAllNotificationsAsRead(token);
      if (result) {
        setUpdatedCount(result.updatedCount);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { markAllAsRead, loading, updatedCount, error };
}
