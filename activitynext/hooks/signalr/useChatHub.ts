// Starter signalR tilkobling til ChatHub. Brukes i layout
import { useEffect } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";
import { ReactionDTO } from "@/types/MessageDTO";

export function useChatHub(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: ReactionDTO) => void
) {
  useEffect(() => {
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
            if ('messageId' in reaction && 'emoji' in reaction && 'userId' in reaction && 'isRemoved' in reaction) {
              onReceiveReaction?.(reaction as ReactionDTO);
            } else {
              console.warn("❌ Ugyldig Reaction-data mottatt:", reaction);
            }
          });
        } catch (err) {
          console.error("❌ SignalR Connection Error:", err);
          setTimeout(startConnection, 2000);
        }
      }
    };

    startConnection();

    return () => {
      console.log("🛑 Stopping SignalR connection...");
      conn.stop();
    };
  }, [onReceiveMessage, onReceiveReaction]);
}