import { useEffect } from "react";
import { fetchAndSetNotifications } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { useAuth } from "@/context/AuthContext"; // eller der du henter user/token fra

export function NotificationInitializer() {
  const { userId } = useAuth(); // eller hent token direkte

  useEffect(() => {
    if (!userId) return;

    fetchAndSetNotifications().catch(console.error);
  }, [userId]);

  return null;
}