// Hooken for å se lese notifications, brukes over notificaiton ikonet i navbaren for å se om vi har noen varlser
import { useEffect, useState } from "react";
import { useNotificationHub } from "@/hooks/useNotificationHub";
import { useAuth } from "@/context/AuthContext";
import { NotificationDTO } from "@/types/NotificationEventDTO";

export function useUnreadNotifications() {
    const { token } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
  
    useNotificationHub({
      onReceive: () => setUnreadCount((prev) => prev + 1),
    });
  
    useEffect(() => {
      const fetchInitial = async () => {
        if (!token) return;
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: NotificationDTO[] = await res.json();
        const unread = data.filter((n: NotificationDTO) => !n.isRead).length;
        setUnreadCount(unread);
      };
      fetchInitial();
    }, [token]);
  
    return unreadCount;
  }
