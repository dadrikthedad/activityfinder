// Her henter vi og bruker SignalR huben til å oppdatere i sanntid ved at NotificationHubClient bruker den globalt. Den henter notifcaitons når det kommer noen nye
import { useEffect } from "react";
import { createNotificationConnection } from "@/utils/signalr/notificationHub";
import { useAuth } from "@/context/AuthContext";
import { NotificationDTO } from "@/types/NotificationEventDTO"; 

interface Options {
    onReceive?: (notification: NotificationDTO) => void;
  }

  export function useNotificationHub(options?: Options) {
    const { token } = useAuth();
    const onReceive = options?.onReceive;
  
    useEffect(() => {
      if (!token) return;
  
      const connection = createNotificationConnection(token);
  
      connection.on("ReceiveNotification", (notification: NotificationDTO) => {
        console.log("New notification:", notification);
        onReceive?.(notification);
      });
  
      connection.onclose(() => {
        console.warn("🔌 SignalR connection closed, attempting to reconnect...");
        setTimeout(() => connection.start().catch(console.error), 2000);
      });
  
      connection.start().catch((err) =>
        console.error("❌ SignalR-tilkobling feilet:", err)
      );
  
      return () => {
        connection.stop();
      };
    }, [token, onReceive]);
  }