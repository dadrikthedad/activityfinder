"use client";

import { useNotificationHub }   from "@/hooks/signalr/useNotificationHub";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useAuth }              from "@/context/AuthContext";

import { getFriendInvitationById } from "@/services/friends/friendService";
import { getNotificationById }     from "@/services/notifications/notificationService";

import type { NotificationDTO } from "@/types/NotificationEventDTO";

export function useRealtimeNotifications() {
  const { token } = useAuth();                    // token kan være undefined rett etter reload

  const addNotification   = useNotificationStore((s) => s.addNotification);
  const addFriendRequest  = useNotificationStore((s) => s.addFriendRequest);
  const notificationsRef  = useNotificationStore((s) => s.notifications);

  useNotificationHub({
    onReceive: async (evt: NotificationDTO) => {
      try {
        /* ------- FriendRequest ------- */
        if (evt.type === "FriendRequest") {
          if (!token) return;                           // ikke logget inn ennå
          const fr = await getFriendInvitationById(evt.id, token);
          if (fr) addFriendRequest(fr);                // legg til bare hvis backend fant noe
          return;
        }

        /* ------- Andre notif-typer ------- */
        if (evt.message || evt.relatedUser) {
          addNotification(evt);                        // komplett objekt
          return;
        }

        const cached = notificationsRef.find((n) => n.id === evt.id);
        if (cached) {
          addNotification(cached);                     // bruk cache
          return;
        }

        if (!token) return;                            // sikkerhets-sjekk
        const full = await getNotificationById(evt.id, token);
        if (full) addNotification(full);
      } catch (err) {
        console.error("❌ Realtime-handler feilet:", err);
      }
    },
  });
}
