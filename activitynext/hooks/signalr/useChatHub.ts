// Starter signalR tilkobling til ChatHub. Brukes i layout
import { useEffect, useRef } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";
import { ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";
import { getPendingMessageRequests } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";


export function useChatHub(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: ReactionDTO, notification?: MessageNotificationDTO) => void,
  onRequestApproved?: (notification: MessageNotificationDTO) => void,
  onRequestCreated?: (data: MessageRequestCreatedDto) => void
) {
  const messageRef = useRef(onReceiveMessage);
  const reactionRef = useRef<
    ((reaction: ReactionDTO, notification?: MessageNotificationDTO) => void) | undefined
  >(onReceiveReaction);
  const approvedRef = useRef<((notification: MessageNotificationDTO) => void) | null>(null);
  const createdRef = useRef(onRequestCreated);
   // Oppdater refs hvis funksjonene endres
  const setPendingMessageRequests = useChatStore.getState().setPendingMessageRequests;
  useEffect(() => { messageRef.current = onReceiveMessage }, [onReceiveMessage]);
  useEffect(() => { reactionRef.current = onReceiveReaction }, [onReceiveReaction]);
  useEffect(() => {
    approvedRef.current = onRequestApproved ?? null;
  }, [onRequestApproved]);
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

          conn.on("ReceiveReaction", (data) => {
            const { reaction, notification } = data;

            if (reaction && 'messageId' in reaction && 'emoji' in reaction) {
              reactionRef.current?.(reaction, notification);
            } else {
              console.warn("❌ Ugyldig reaction-data mottatt:", data);
            }
          });

          conn.on("MessageRequestApproved", (notification: MessageNotificationDTO) => {
            console.log("✅ Mottatt godkjenningsnotifikasjon:", notification);

            // 1. Send den til callback hvis noen bruker den
            approvedRef.current?.(notification);

            // 2. Eller legg den rett i notification-store:
            useMessageNotificationStore.getState().upsertNotification(notification);
          });

          conn.on("MessageRequestCreated", async (data: MessageRequestCreatedDto) => {
            console.log("📨 Ny meldingsforespørsel mottatt:", data);

             const { notification } = data;

              if (notification) {
                useMessageNotificationStore.getState().upsertNotification(notification); // 👈 oppdater notificationpanel
              }

            try {
              const updated = await getPendingMessageRequests();
              setPendingMessageRequests(updated ?? []);
            } catch (err) {
              console.error("❌ Feil ved oppdatering av meldingsforespørsler:", err);
            }

            // Hvis du fortsatt vil trigge ekstern callback (f.eks. for toast):
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