// Her markerer vi at alle notificaitons har blitt lest ved å fetche fra backend
import { markAllNotificationsAsRead } from "@/services/notifications/markAllNotificationsAsRead";
import { useCallback, useState } from "react";
import authServiceNative from "@/services/user/authServiceNative";

export function useMarkAllNotificationsAsRead() {
  const [loading, setLoading] = useState(false);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const markAllAsRead = useCallback(async () => {
    const token = await authServiceNative.getAccessToken();
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
  }, []);
  

  return { markAllAsRead, loading, updatedCount, error };
}
