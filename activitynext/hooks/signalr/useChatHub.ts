// Starter signalR tilkobling til ChatHub. Brukes i layout
import { useEffect, useRef } from "react";
import { createChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";
import { MessageDTO } from "@/types/MessageDTO";
import { ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { GroupRequestCreatedDto } from "@/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO } from "@/types/GroupNotificationUpdateDTO";
import { GroupDisbandedDto } from "@/types/GroupDisbandedDTO";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

export function useChatHub(
  onReceiveMessage?: (message: MessageDTO) => void,
  onReceiveReaction?: (reaction: ReactionDTO, notification?: MessageNotificationDTO) => void,
  onRequestApproved?: (notification: MessageNotificationDTO) => void,
  onRequestCreated?: (data: MessageRequestCreatedDto) => void,
  onGroupRequestCreated?: (data: GroupRequestCreatedDto) => void,
  onGroupNotificationUpdated?: (data: GroupNotificationUpdateDTO) => void,
  onGroupDisbanded?: (data: GroupDisbandedDto) => void,
  onGroupParticipantsUpdated?: (conversationId: number) => void,
  onMessageDeleted?: (data: { conversationId: number; message: MessageDTO }) => void,
  onReceiveNotification?: (notification: NotificationDTO) => void,
  onUserProfileUpdated?: (data: { 
    userId: number; 
    updatedFields: string[]; 
    updatedValues: Partial<UserSummaryDTO>; 
    updatedAt: string 
  }) => void,
  onUserBlockedUpdated?: (data: UserSummaryDTO) => void,
) {
  const messageRef = useRef(onReceiveMessage);
  const reactionRef = useRef<
    ((reaction: ReactionDTO, notification?: MessageNotificationDTO) => void) | undefined
  >(onReceiveReaction);
  const approvedRef = useRef<((notification: MessageNotificationDTO) => void) | null>(null);
  const createdRef = useRef(onRequestCreated);
  const groupRequestCreatedRef = useRef(onGroupRequestCreated);
  const groupNotificationUpdatedRef = useRef(onGroupNotificationUpdated);
  const groupDisbandedRef = useRef(onGroupDisbanded);
  const groupParticipantsUpdatedRef = useRef(onGroupParticipantsUpdated);
  const messageDeletedRef = useRef(onMessageDeleted);
  const notificationRef = useRef(onReceiveNotification); 
  const userProfileUpdatedRef = useRef(onUserProfileUpdated);
  const userBlockedUpdatedRef = useRef(onUserBlockedUpdated);


  // Oppdater refs hvis funksjonene endres
  useEffect(() => { messageRef.current = onReceiveMessage }, [onReceiveMessage]);
  useEffect(() => { reactionRef.current = onReceiveReaction }, [onReceiveReaction]);
  useEffect(() => {
    approvedRef.current = onRequestApproved ?? null;
  }, [onRequestApproved]);
  useEffect(() => { createdRef.current = onRequestCreated }, [onRequestCreated]);
  useEffect(() => { groupRequestCreatedRef.current = onGroupRequestCreated }, [onGroupRequestCreated]);
  useEffect(() => { groupNotificationUpdatedRef.current = onGroupNotificationUpdated }, [onGroupNotificationUpdated]);
  useEffect(() => { groupDisbandedRef.current = onGroupDisbanded }, [onGroupDisbanded]);
  useEffect(() => { groupParticipantsUpdatedRef.current = onGroupParticipantsUpdated }, [onGroupParticipantsUpdated]);
  useEffect(() => { messageDeletedRef.current = onMessageDeleted }, [onMessageDeleted]);
  useEffect(() => { notificationRef.current = onReceiveNotification }, [onReceiveNotification]);
  useEffect(() => { userProfileUpdatedRef.current = onUserProfileUpdated }, [onUserProfileUpdated]);
  useEffect(() => { userBlockedUpdatedRef.current = onUserBlockedUpdated }, [onUserBlockedUpdated]);

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
          console.log("✅ Connected to the hub");

          // Fjern alle tidligere event listeners
          conn.off("ReceiveMessage");
          conn.off("ReceiveReaction");
          conn.off("MessageRequestApproved");
          conn.off("MessageRequestCreated");
          conn.off("GroupRequestCreated");
          conn.off("GroupNotificationUpdated");
          conn.off("MessageDeleted");
          conn.off("ReceiveNotification");
          conn.off("UserProfileUpdated");
          conn.off("UserBlockedUpdated");

          conn.on("ReceiveMessage", (message: MessageDTO) => {
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
            console.log("🧪 Type på notification i godkjenning:", notification?.type);

            // 1. Send den til callback hvis noen bruker den
            approvedRef.current?.(notification);
          
            // 2. Eller legg den rett i notification-store:
            useMessageNotificationStore.getState().upsertNotification(notification);
          });

          conn.on("MessageRequestCreated", (data: MessageRequestCreatedDto) => {
            console.log("📨 Ny meldingsforespørsel mottatt:", data);

            const { notification } = data;

            if (notification && notification.type !== "MessageRequestApproved") {
              useMessageNotificationStore.getState().upsertNotification(notification);
            }

            // Send videre til frontend-logikk (f.eks. for toast + sync)
            createdRef.current?.(data);
          });

          conn.on("GroupRequestCreated", (data: GroupRequestCreatedDto) => {
            console.log("👥 Ny gruppeforespørsel mottatt:", data);

            const { notification } = data;

            // Add notification to store (similar to MessageRequestCreated)
            if (notification && notification.type !== "MessageRequestApproved") {
              useMessageNotificationStore.getState().upsertNotification(notification);
            }

            // Send videre til frontend-logikk
            groupRequestCreatedRef.current?.(data);
          });

          conn.on("GroupNotificationUpdated", (data: GroupNotificationUpdateDTO) => {
            console.log("🔔 GroupNotification oppdatert via SignalR:", data);

            // Send videre til frontend-logikk
            groupNotificationUpdatedRef.current?.(data);
          });

          conn.on("GroupDisbanded", (data: GroupDisbandedDto) => {
            console.log("💥 Group disbanded via SignalR:", data);
            groupDisbandedRef.current?.(data);
          });

          conn.on("GroupParticipantsUpdated", (data: { conversationId: number }) => {
            console.log("🔁 Group participants updated via SignalR:", data);
            groupParticipantsUpdatedRef.current?.(data.conversationId);
          });

          conn.on("MessageDeleted", (data: { conversationId: number; message: MessageDTO }) => {
            console.log("🗑️ Message deleted via SignalR:", data);
            messageDeletedRef.current?.(data);
          });

          // Lagt til generell notifikasjonshåndtering
          conn.on("ReceiveNotification", (notification: NotificationDTO) => {
            console.log("📥 ReceiveNotification event mottatt i useChatHub:", notification);
            console.log("🎯 notificationRef.current er:", !!notificationRef.current);
            notificationRef.current?.(notification);
          });

          // Oppdatering av en brukerprofil etter en endring
          conn.on("UserProfileUpdated", (data: { 
            userId: number; 
            updatedFields: string[]; 
            updatedValues: Partial<UserSummaryDTO>; // 🔄 Endret fra Record<string, any>
            updatedAt: string 
          }) => {
            console.log("👤 User profile updated via SignalR:", data);
            userProfileUpdatedRef.current?.(data);
          });

          conn.on("UserBlockedUpdated", (data) => {
            console.log("🚫 You were blocked/unblocked via SignalR:", data);
            userBlockedUpdatedRef.current?.(data);
          });

        } catch (err) {
          console.error("❌ SignalR Connection Error:", err);
          setTimeout(startConnection, 2000);
        }
      }
    };

    startConnection();

    // 🆕 Lagt til reconnection logic (fra NotificationHub)
    conn.onclose(() => {
      console.warn("🔌 SignalR-tilkobling brutt. Prøver igjen om 2 sek...");
      setTimeout(() => startConnection(), 2000);
    });

    return () => {
      console.log("🛑 Stopping SignalR connection...");
      conn.stop();
    };
  }, []); // ← viktig: kjør bare én gang
}