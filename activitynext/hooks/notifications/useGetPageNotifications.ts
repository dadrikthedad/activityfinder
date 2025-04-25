// Her henter vi 100 notificaitons til /notifications ved å bruke en fetch til backend
import { useEffect, useState } from "react";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { useAuth } from "@/context/AuthContext";
import { getPageNotifications } from "@/services/notifications/getPageNotifications";

export function useGetPageNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const result = await getPageNotifications(token);
        setNotifications(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token]);

  return { notifications, loading, error };
}
