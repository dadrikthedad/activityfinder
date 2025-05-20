import { useEffect, useState } from "react";
import { getMessageNotifications } from "@/services/messages/messageNotificationService";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";

export function useMessageNotifications(pageSize = 20) {
  const [notifications, setNotifications] = useState<MessageNotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const data = await getMessageNotifications(pageToLoad, pageSize);
      setNotifications(prev => [...prev, ...data.notifications]);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(page);
  }, [page]);

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