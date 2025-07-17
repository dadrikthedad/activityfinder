"use client";
// Hjelpefunksjon som gjør at vi laster inn alt i MessageDropdown i navbaren ved at vi er innlogget.
import { useEffect, useRef } from "react";
import { fetchAndSetMessageNotifications } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { useAuth } from "@/context/AuthContext";
import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { fetchAndSetFriendRequests } from "@/hooks/friends/useFriendInvitationsInit";
import { fetchAndSetNotifications } from "@/hooks/notifications/useGetNotifications";

export function MessageDropdownInitializer() {
  const { userId, token } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    /***** Ikke logget inn ennå? *****/
    if (!token || !userId) return;

    /***** Ny bruker i samme sesjon? Nulle alt *****/
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      useChatStore.getState().reset?.();
      useNotificationStore.getState().reset();
      useMessageNotificationStore.getState().reset(); // 🆕 reset message notifications også
    }
    prevUserIdRef.current = userId;
    console.log("🚀 Initializer TRIGGERED with userId =", userId);

    // --- HENT CURRENT STATE ---
    const notifSt = useNotificationStore.getState();
    const msgNotifSt = useMessageNotificationStore.getState(); // 🆕

    // --- CONDITIONAL LOADING BASERT PÅ EXISTING DATA ---


    // 4) Friend Requests
    if (!notifSt.hasLoadedFriendRequests || notifSt.friendRequests.length === 0) {
      console.log("👥 Loading friend requests...");
      notifSt.setHasLoadedFriendRequests(true);
      fetchAndSetFriendRequests(token);
    } else {
      console.log("✅ Friend requests already loaded from IndexedDB:", notifSt.friendRequests.length);
    }

    // 5) General Notifications
    if (!notifSt.hasLoadedNotifications || notifSt.notifications.length === 0) {
      console.log("🔔 Loading general notifications...");
      notifSt.setHasLoadedNotifications(true);
      fetchAndSetNotifications(1, 50);
    } else {
      console.log("✅ General notifications already loaded from IndexedDB:", notifSt.notifications.length);
    }

  }, [token, userId]);

  return null;
}