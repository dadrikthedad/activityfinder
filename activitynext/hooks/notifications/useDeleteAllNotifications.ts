// her sletter vi alle notificaitons ved å sende en delete til backend
"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { deleteAllNotifications } from "@/services/notifications/deleteAllNotifications";
import { useNotificationStore } from "@/store/useNotificationStore";

/**
 * Sletter ALLE notifikasjoner hos backend *og* nullstiller lista i zustand-storen.
 */
export function useDeleteAllNotifications() {
  const { token } = useAuth();

  const clearNotifications = useNotificationStore(
    (s) => s.clearNotifications,   // action du la til i store
  );

  const [loading, setLoading] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const deleteAll = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await deleteAllNotifications(token); // backend-kall
      setDeletedCount(result.deletedCount);

      clearNotifications();                               // zustand-update
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [token, clearNotifications]);

  return { deleteAll, loading, deletedCount, error };
}
