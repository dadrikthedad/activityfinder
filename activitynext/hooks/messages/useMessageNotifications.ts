import { useEffect, useState } from "react";
import { getMessageNotifications } from "@/services/messages/messageNotificationService";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export function useMessageNotifications(pageSize = 20) {
  const [notifications, setNotifications] = useState<MessageNotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ Hent fra store
  const messageNotifications = useMessageNotificationStore((s) => s.notifications);

  useEffect(() => {
  const fetchNotifications = async () => {
    if (page === 1 && messageNotifications.length > 0) {
      setNotifications(messageNotifications);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getMessageNotifications(page, pageSize);
      console.log("📦 API response:", data);

      // Lokalt tilstanden i hook
      setNotifications((prev) => {
        const combined = [...prev, ...data.notifications];
        const uniqueById = new Map<number, MessageNotificationDTO>();
        combined.forEach((n) => uniqueById.set(n.id, n));
        return Array.from(uniqueById.values());
      });

      // 🔗 ZUSTAND oppdatering for side 1 (sanntidssynk)
      if (page === 1) {
        useMessageNotificationStore
          .getState()
          .setNotifications(data.notifications);
      }

      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  fetchNotifications();
}, [page, pageSize]);

  const loadMore = () => {
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const hasMore = page < totalPages;

  return {
    notifications,
    loading,
    error,
    loadMore,
    hasMore
  };
}
