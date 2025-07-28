"use client";

import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth }              from "@/context/AuthContext";
import { getFriendInvitationById } from "@/services/friends/friendService";
import { getNotificationById }     from "@/services/notifications/notificationService";
import type { NotificationDTO } from "@/types/NotificationEventDTO";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";
import { showNotificationToast } from "../toast/Toast";
import { LocalToastType } from "../toast/Toast";
import { useSignalRService } from "./SignalRService";

export function useRealtimeNotifications() {
  const { token } = useAuth();                    // token kan være undefined rett etter reload

  const addNotification   = useNotificationStore((s) => s.addNotification);
  const addFriendRequest  = useNotificationStore((s) => s.addFriendRequest);
  const notificationsRef  = useNotificationStore((s) => s.notifications);
  const setFriendRequestTotalCount = useNotificationStore((s) => s.setFriendRequestTotalCount);
  const friendRequestTotalCount = useNotificationStore((s) => s.friendRequestTotalCount);

  useSignalRService({
    onNotification: async (evt: NotificationDTO) => {
       try {
        // 🟢 Ny venneforespørsel
        if (evt.type === "FriendInvitation") {
          if (!token || !evt.friendInvitationId) return;
          const fr = await getFriendInvitationById(evt.friendInvitationId, token);
          addNotification(evt);
          if (fr) {
            addFriendRequest(fr);
            setFriendRequestTotalCount(friendRequestTotalCount + 1);
            showNotificationToast({
              senderName: fr.userSummary?.fullName ?? "Someone",
              conversationId: -1, // ikke en samtale ennå
              type: LocalToastType.FriendRequestReceived,
            });
          }
          return;
        }

        // 🟢 Venneforespørsel akseptert – bare vis i listen
        if (evt.type === "FriendInvAccepted") {
          addNotification(evt);

            if (evt.relatedUser) {
              showNotificationToast({
                senderName: evt.relatedUser.fullName ?? "Someone",
                type: LocalToastType.FriendInvAccepted,
                relatedUser: evt.relatedUser,
              });
            }
          

            if (evt.conversationId) {
              await finalizeConversationApproval(evt.conversationId);
            }
          return;
        }

        // 🔄 Andre typer (med melding eller relatert bruker)
        if (evt.message || evt.relatedUser) {
          addNotification(evt);
          return;
        }

        // 🔁 Hent fra cache hvis tilgjengelig
        const cached = notificationsRef.find((n) => n.id === evt.id);
        if (cached) {
          addNotification(cached);
          return;
        }

        // 🔁 Hent full notifikasjon hvis ikke i cache
        if (!token) return;
        const full = await getNotificationById(evt.id, token);
        if (full) addNotification(full);

      } catch (err) {
        console.error("❌ Realtime-handler feilet:", err);
      }
    }}
  );
}