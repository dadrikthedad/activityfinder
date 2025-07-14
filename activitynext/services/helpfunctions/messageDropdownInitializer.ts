"use client";
// Hjelpefunksjon som gjør at vi laster inn alt i MessageDropdown i navbaren ved at vi er innlogget.
import { useEffect, useRef } from "react";
import { fetchAndSetMessageNotifications } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { getPendingMessageRequests } from "@/services/messages/messageService";
import { useAuth } from "@/context/AuthContext";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { getUnreadConversationIds } from "@/services/messages/messageNotificationService";
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
    const chatSt = useChatStore.getState();
    const notifSt = useNotificationStore.getState();
    const msgNotifSt = useMessageNotificationStore.getState(); // 🆕

    // --- CONDITIONAL LOADING BASERT PÅ EXISTING DATA ---
    
    // 1) Unread Conversation IDs
    if (!chatSt.hasLoadedUnreadConversationIds || chatSt.unreadConversationIds.length === 0) {
      console.log("📬 Loading unread conversation IDs...");
      chatSt.setHasLoadedUnreadConversationIds(true);
      getUnreadConversationIds()
        .then(ids => {
          console.log("✅ Loaded unread conversation IDs:", ids?.length);
          chatSt.setUnreadConversationIds(ids ?? []);
        })
        .catch(console.error);
    } else {
      console.log("✅ Unread conversation IDs already loaded from IndexedDB:", chatSt.unreadConversationIds.length);
    }

    // 2) Pending Message Requests
    if (!chatSt.hasLoadedPendingRequests || chatSt.pendingMessageRequests.length === 0) {
      console.log("📮 Loading pending message requests...");
      chatSt.setHasLoadedPendingRequests(true);
      getPendingMessageRequests()
        .then(req => {
          console.log("✅ Loaded pending requests:", req?.length);
          chatSt.setPendingMessageRequests(req ?? []);
          chatSt.setCachedPendingRequests(req ?? []);
        })
        .catch(console.error);
    } else {
      console.log("✅ Pending requests already loaded from IndexedDB:", chatSt.pendingMessageRequests.length);
    }

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

    // 6) Message Notifications - alltid kjør denne for å få oppdateringer
    if (!msgNotifSt.hasLoadedNotifications || msgNotifSt.notifications.length === 0) {
      console.log("📨 Loading message notifications...");
      msgNotifSt.setHasLoadedNotifications(true);
      fetchAndSetMessageNotifications().catch(console.error);
    } else {
      console.log("✅ Message notifications already loaded from IndexedDB:", msgNotifSt.notifications.length);
      // Kan fortsatt kjøre for å få nyeste oppdateringer
      fetchAndSetMessageNotifications().catch(console.error);
    }

  }, [token, userId]);

  return null;
}

export async function fetchInitialConversations(take = 20) {
  const skip = 0;
  const response = await getMyConversations(skip, take);
  const conversations = response?.conversations ?? [];
  
  if (conversations.length > 0) {
    const addConversation = useChatStore.getState().addConversation;
    conversations.forEach(addConversation);
    console.log("✅ Loaded conversations from API:", conversations.length);
  }
  
  return conversations.length < take ? false : true;
}