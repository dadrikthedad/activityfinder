// her sletter vi alle notificaitons ved å sende en delete til backend
import { useAuth } from "@/context/AuthContext";
import { deleteAllNotifications } from "@/services/notifications/deleteAllNotifications";
import { useCallback, useState } from "react";

export function useDeleteAllNotifications() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const deleteAll = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await deleteAllNotifications(token);
      setDeletedCount(result.deletedCount);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { deleteAll, loading, deletedCount, error };
}
