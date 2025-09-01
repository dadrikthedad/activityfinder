// src/hooks/notifications/useNotificationById.ts
import { useEffect, useState } from "react";
import { getNotificationById } from "@/services/notifications/notificationService";
import { useNotificationStore } from "@/store/useNotificationStore";
import authServiceNative from '@/services/user/authServiceNative';

export function useNotificationById(id: number) {

  /* ---- selektorer som er stabile ---- */
  const addNotification = useNotificationStore((s) => s.addNotification);
  const notification    = useNotificationStore(
    (s) => s.notifications.find((n) => n.id === id),
  );

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<Error | null>(null);

  /* ---- hent én gang ved mount hvis nødvendig ---- */
  useEffect(() => {
  if (notification) return; // Already cached
  
  const fetchNotification = async () => {
      const token = await authServiceNative.getAccessToken();
      if (!token) return; // Still needed for safety
      
      setLoading(true);
      try {
        const res = await getNotificationById(id, token);
        if (res) addNotification(res);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotification();
  }, [id, notification, addNotification]);

  return { notification: notification ?? null, loading, error };
}