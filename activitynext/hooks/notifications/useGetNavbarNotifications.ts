// Her henter vi 15 notificaitons til navbaren ved å bruke en fetch til backend
import { useEffect, useState } from "react";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { useAuth } from "@/context/AuthContext";
import { getNavbarNotifications } from "@/services/notifications/getNavbarNotifications";

export function useGetNavbarNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const result = await getNavbarNotifications(token);
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
