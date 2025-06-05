import { useEffect, useState } from "react";
import { getMessageNotifications } from "@/services/messages/messageNotificationService";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export function useMessageNotifications(pageSize = 20) {
  const [localNotifications, setLocalNotifications] = useState<MessageNotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const messageNotifications = useMessageNotificationStore((s) => s.notifications);
  const hasLoaded = useMessageNotificationStore((s) => s.hasLoadedNotifications);
  const setStoreNotifications = useMessageNotificationStore((s) => s.setNotifications);
  const setHasLoaded = useMessageNotificationStore((s) => s.setHasLoadedNotifications);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (page === 1 && hasLoaded) {
        setLocalNotifications(messageNotifications);
        return;
      }

      setLoading(true);
      try {
        const data = await getMessageNotifications(page, pageSize);

        setLocalNotifications((prev) => {
          const combined = [...prev, ...data.notifications];
          const uniqueById = new Map<number, MessageNotificationDTO>();
          combined.forEach((n) => uniqueById.set(n.id, n));
          return Array.from(uniqueById.values());
        });

        if (page === 1) {
          setStoreNotifications(data.notifications);
          setHasLoaded(true);
        }

        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Ukjent feil"));
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [page, pageSize, hasLoaded, messageNotifications]);

  const loadMore = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const hasMore = page < totalPages;

  return {
    notifications: localNotifications,
    loading,
    error,
    loadMore,
    hasMore,
  };
}
