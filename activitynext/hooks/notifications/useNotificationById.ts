// src/hooks/notifications/useNotificationById.ts
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getNotificationById } from "@/services/notifications/notificationService";
import { useNotificationStore } from "@/store/useNotificationStore";

export function useNotificationById(id: number) {
  const { token } = useAuth();

  /* ---- selektorer som er stabile ---- */
  const addNotification = useNotificationStore((s) => s.addNotification);
  const notification    = useNotificationStore(
    (s) => s.notifications.find((n) => n.id === id),
  );

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<Error | null>(null);

  /* ---- hent én gang ved mount hvis nødvendig ---- */
  useEffect(() => {
    if (notification || !token) return;        // allerede i cache eller ikke logget inn

    setLoading(true);
    getNotificationById(id, token)
      .then((res) => {
        if (res) addNotification(res);         // putt i store
      })
      .catch((err) => setError(err as Error))
      .finally(() => setLoading(false));
  }, [id, token, notification, addNotification]);

  return { notification: notification ?? null, loading, error };
}