import { useEffect, useState } from "react";
import { getMessageNotifications } from "@/services/messages/messageNotificationService";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useChatStore } from "@/store/useChatStore";

export function useMessageNotifications(pageSize = 20) {
  const [notifications, setNotifications] = useState<MessageNotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ Hent fra store
  const {
    messageNotifications,
    setMessageNotifications
  } = useChatStore();

  useEffect(() => {
    const fetchNotifications = async () => {
      // ✅ Bruk cached data ved første load
      if (page === 1 && messageNotifications.length > 0) {
        setNotifications(messageNotifications);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await getMessageNotifications(page, pageSize);
        console.log("📦 API response:", data);
        setNotifications(prev => {
          const combined = [...prev, ...data.notifications];
          const uniqueById = new Map<number, MessageNotificationDTO>();
          combined.forEach(n => uniqueById.set(n.id, n));
          return Array.from(uniqueById.values());
        });

        // ✅ Cache kun første side i store
        if (page === 1) {
          setMessageNotifications(data.notifications);
        }

        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Ukjent feil"));
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [page, pageSize, messageNotifications, setMessageNotifications]);

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
