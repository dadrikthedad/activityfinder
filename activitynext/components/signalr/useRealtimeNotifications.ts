"use client";

import { useNotificationHub }   from "@/hooks/signalr/useNotificationHub";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth }              from "@/context/AuthContext";
import { getFriendInvitationById } from "@/services/friends/friendService";
import { getNotificationById }     from "@/services/notifications/notificationService";
import type { NotificationDTO } from "@/types/NotificationEventDTO";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";

export function useRealtimeNotifications() {
  const { token } = useAuth();                    // token kan være undefined rett etter reload

  const addNotification   = useNotificationStore((s) => s.addNotification);
  const addFriendRequest  = useNotificationStore((s) => s.addFriendRequest);
  const notificationsRef  = useNotificationStore((s) => s.notifications);

   useNotificationHub({
    onReceive: async (evt: NotificationDTO) => {
      try {
        // 🟢 Ny venneforespørsel
        if (evt.type === "FriendInvitation") {
          if (!token || !evt.friendInvitationId) return;
          const fr = await getFriendInvitationById(evt.friendInvitationId, token);
          if (fr) addFriendRequest(fr);
          return;
        }

        // 🟢 Venneforespørsel akseptert – bare vis i listen
        if (evt.type === "FriendInvAccepted") {
          addNotification(evt);

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
    },
  });
}
