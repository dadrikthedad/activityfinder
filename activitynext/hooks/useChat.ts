"use client";

import { useEffect } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";

export function useChat(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: { messageId: number; emoji: string; userId: string }) => void
) {
  useEffect(() => {
    const conn = createChatConnection();

    const startConnection = async () => {
      if (conn.state === signalR.HubConnectionState.Disconnected) {
        try {
          await conn.start();
          console.log("✅ Connected to ChatHub");

          // Registrer event listeners
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
        }
      }
    };

    startConnection();

    // ❌ Ikke stopp global delt forbindelse
    return () => {
      // Do nothing on unmount
    };
  }, [onReceiveMessage, onReceiveReaction]);
}
