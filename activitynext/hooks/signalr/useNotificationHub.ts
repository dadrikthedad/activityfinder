// Her henter vi og bruker SignalR huben til å oppdatere i sanntid ved at NotificationHubClient bruker den globalt. Den henter notifcaitons når det kommer noen nye
import { useEffect } from "react";
import { createNotificationConnection, getConnection  } from "@/utils/signalr/notificationHub";
import { NotificationDTO } from "@/types/NotificationEventDTO"; 

interface Options {
    onReceive?: (notification: NotificationDTO) => void;
  }

  export function useNotificationHub(options?: Options) {
    const onReceive = options?.onReceive;
  
    useEffect(() => {
      const connection = getConnection() ?? createNotificationConnection();
  
      connection.off("ReceiveNotification"); // Fjern tidligere event listener
  
      connection.on("ReceiveNotification", (notification: NotificationDTO) => {
        console.log("📥 New notification:", notification);
        onReceive?.(notification);
      });
  
      const tryStart = async () => {
        if (connection.state === "Disconnected") {
          try {
            await connection.start();
            console.log("✅ Connected to NotificationHub");
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
    }, [onReceive]);
  }