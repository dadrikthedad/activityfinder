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
      console.log("🔔 onNotification callback kjørt med:", evt);
      console.log("🔑 Token tilgjengelig:", !!token);
      console.log("📊 Current friendRequestTotalCount:", friendRequestTotalCount);
      
      try {
        // 🟢 Ny venneforespørsel
        if (evt.type === "FriendInvitation") {
          console.log("✅ FriendInvitation detected, friendInvitationId:", evt.friendInvitationId);
          
          if (!token || !evt.friendInvitationId) {
            console.warn("⚠️ Token eller friendInvitationId mangler:", { token: !!token, friendInvitationId: evt.friendInvitationId });
            return;
          }

          console.log("🔄 Henter friend invitation med ID:", evt.friendInvitationId);
          const fr = await getFriendInvitationById(evt.friendInvitationId, token);
          console.log("📥 Friend invitation hentet:", fr);

          console.log("➕ Legger til notification i store...");
          addNotification(evt);
          console.log("✅ Notification lagt til i store");

          if (fr) {
            console.log("➕ Legger til friend request i store...");
            addFriendRequest(fr);
            console.log("✅ Friend request lagt til i store");

            const newCount = friendRequestTotalCount + 1;
            console.log("🔢 Oppdaterer friend request count fra", friendRequestTotalCount, "til", newCount);
            setFriendRequestTotalCount(newCount);
            console.log("✅ Friend request count oppdatert");

            console.log("🍞 Viser notification toast...");
            showNotificationToast({
              senderName: fr.userSummary?.fullName ?? "Someone",
              conversationId: -1, // ikke en samtale ennå
              type: LocalToastType.FriendRequestReceived,
            });
            console.log("✅ Toast vist");
          } else {
            console.warn("⚠️ Friend request kunne ikke hentes");
          }
          return;
        }

        // 🟢 Venneforespørsel akseptert – bare vis i listen
        if (evt.type === "FriendInvAccepted") {
          console.log("✅ FriendInvAccepted detected");
          addNotification(evt);
          console.log("✅ FriendInvAccepted notification lagt til i store");

          if (evt.relatedUser) {
            console.log("🍞 Viser FriendInvAccepted toast for:", evt.relatedUser.fullName);
            showNotificationToast({
              senderName: evt.relatedUser.fullName ?? "Someone",
              type: LocalToastType.FriendInvAccepted,
              relatedUser: evt.relatedUser,
            });
          }

          if (evt.conversationId) {
            console.log("🔄 Finalizing conversation approval for:", evt.conversationId);
            await finalizeConversationApproval(evt.conversationId);
          }
          return;
        }

        // 🔄 Andre typer (med melding eller relatert bruker)
        if (evt.message || evt.relatedUser) {
          console.log("ℹ️ Andre notification type med message/relatedUser");
          addNotification(evt);
          return;
        }

        // 🔁 Hent fra cache hvis tilgjengelig
        const cached = notificationsRef.find((n) => n.id === evt.id);
        if (cached) {
          console.log("📋 Fant cached notification, legger til");
          addNotification(cached);
          return;
        }

        // 🔁 Hent full notifikasjon hvis ikke i cache
        if (!token) {
          console.warn("⚠️ Ingen token tilgjengelig for å hente full notification");
          return;
        }
        
        console.log("🔄 Henter full notification fra API...");
        const full = await getNotificationById(evt.id, token);
        if (full) {
          console.log("✅ Full notification hentet og lagt til");
          addNotification(full);
        } else {
          console.warn("⚠️ Kunne ikke hente full notification");
        }
      } catch (err) {
        console.error("❌ Realtime-handler feilet:", err);
      }
    }
  });
}