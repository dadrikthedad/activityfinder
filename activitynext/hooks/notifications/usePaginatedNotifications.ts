"use client";


// Kanskje slette?
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { getNotifications } from "@/services/notifications/getNotifications";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { NotificationDTO } from "@/types/NotificationEventDTO";

/**
 * SWR som henter en gitt page og samtidig pusher resultatet i store.
 * Brukes f.eks. i /notifications-siden for «Load more».
 */
export function usePaginatedNotifications(page = 1, pageSize = 50) {
  const { token } = useAuth();

  const setNotifications  = useNotificationStore((s) => s.setNotifications);
  const addNotification   = useNotificationStore((s) => s.addNotification);

  const fetcher = async (): Promise<NotificationDTO[]> => {
    if (!token) return [];
    const data = (await getNotifications(page, pageSize)) ?? [];

    // sync mot store
    if (page === 1) {
      setNotifications(data);
    } else {
      data.forEach(addNotification);
    }
    return data;
  };

  return useSWR(
    token ? `/notifications?page=${page}&pageSize=${pageSize}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}