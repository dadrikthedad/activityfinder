// Starter signalR tilkobling til ChatHub. Brukes i layout
import { useEffect, useRef } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";
import { ReactionDTO } from "@/types/MessageDTO";

export function useChatHub(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: ReactionDTO) => void,
  onRequestApproved?: (data: { ReceiverId: number; ConversationId: number }) => void,
  onRequestCreated?: (data: { SenderId: number; ReceiverId: number; ConversationId: number }) => void,
) {
  const messageRef = useRef(onReceiveMessage);
  const reactionRef = useRef(onReceiveReaction);
  const approvedRef = useRef(onRequestApproved);
  const createdRef = useRef(onRequestCreated);
   // Oppdater refs hvis funksjonene endres
  useEffect(() => { messageRef.current = onReceiveMessage }, [onReceiveMessage]);
  useEffect(() => { reactionRef.current = onReceiveReaction }, [onReceiveReaction]);
  useEffect(() => { approvedRef.current = onRequestApproved }, [onRequestApproved]);
  useEffect(() => { createdRef.current = onRequestCreated }, [onRequestCreated]);

  useEffect(() => {
    const conn = createChatConnection();

    const startConnection = async () => {
      if (typeof window === "undefined") return;

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
          conn.off("MessageRequestApproved");
          conn.off("MessageRequestCreated");

          conn.on("ReceiveMessage", (message: MessageDTO) => {
            console.log("📩 Received:", message);
            messageRef.current?.(message);
          });

          conn.on("ReceiveReaction", (reaction) => {
            if ('messageId' in reaction && 'emoji' in reaction && 'userId' in reaction && 'isRemoved' in reaction) {
              reactionRef.current?.(reaction as ReactionDTO);
            } else {
              console.warn("❌ Ugyldig Reaction-data mottatt:", reaction);
            }
          });

          conn.on("MessageRequestApproved", (data) => {
            console.log("✅ Meldingsforespørsel godkjent:", data);
            approvedRef.current?.(data);
          });

          conn.on("MessageRequestCreated", (data) => {
            console.log("📨 Forespørsel opprettet via SignalR:", data);
            createdRef.current?.(data);
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
  }, []); // ← viktig: kjør bare én gang
}