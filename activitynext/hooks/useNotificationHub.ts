// Her henter vi og bruker SignalR huben til å oppdatere i sanntid ved at NotificationHubClient bruker den globalt. Den henter notifcaitons når det kommer noen nye
import { useEffect } from "react";
import { createNotificationConnection, getConnection  } from "@/utils/signalr/notificationHub";
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
  
      let connection = getConnection();
  
      if (!connection) {
        connection = createNotificationConnection(token);
      }
  
      // Fjern gammel lytter hvis finnes (hindrer multiple callbacks)
      connection.off("ReceiveNotification");
  
      connection.on("ReceiveNotification", (notification: NotificationDTO) => {
        console.log("📥 New notification:", notification);
        onReceive?.(notification);
      });
  
      const tryStart = async () => {
        if (connection.state === "Disconnected") {
          try {
            await connection.start();
          } catch (err) {
            console.error("❌ SignalR-tilkobling feilet:", err);
          }
        }
      };
  
      tryStart();
  
      connection.onclose(() => {
        console.warn("🔌 SignalR-tilkobling brutt. Prøver igjen om 2 sek...");
        setTimeout(() => tryStart(), 2000);
      });
  
      // 🚫 Ikke stopp forbindelsen – den kan brukes av andre
      return () => {};
    }, [token, onReceive]);
  }