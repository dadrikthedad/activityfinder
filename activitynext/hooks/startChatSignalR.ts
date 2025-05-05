// hooks/startChatSignalR.ts
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";

export function startChatSignalR(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: { messageId: number; emoji: string; userId: string }) => void
) {
  const conn = createChatConnection();

  const startConnection = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("⏳ Token not available yet, retrying in 1s...");
      setTimeout(startConnection, 1000);
      return;
    }

    if (conn.state === signalR.HubConnectionState.Disconnected) {
      try {
        await conn.start();
        console.log("✅ Connected to ChatHub");

        conn.off("ReceiveMessage");
        conn.off("ReceiveReaction");

        conn.on("ReceiveMessage", (message: MessageDTO) => {
          console.log("📩 Received:", message);
          onReceiveMessage?.(message);
        });

        conn.on("ReceiveReaction", (reaction) => {
          console.log("🎉 Reaction:", reaction);
          onReceiveReaction?.(reaction);
        });
      } catch (err) {
        console.error("❌ SignalR Connection Error:", err);
        setTimeout(startConnection, 2000);
      }
    }
  };

  startConnection();
}
