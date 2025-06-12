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
      useChatStore.getState().resetStore?.();   // eller hardReset()
      useNotificationStore.getState().reset();
    }
    prevUserIdRef.current = userId;

    console.log("🚀 Initializer TRIGGERED with userId =", userId);

       // --- 1) SETT FLAGGENE MED EN GANG ----------------
  const chatSt  = useChatStore.getState();
  const notifSt = useNotificationStore.getState();

  if (!chatSt.hasLoadedUnreadConversationIds)
    chatSt.setHasLoadedUnreadConversationIds(true);
  if (!chatSt.hasLoadedPendingRequests)
    chatSt.setHasLoadedPendingRequests(true);
  if (!chatSt.hasLoadedConversations)
    chatSt.setHasLoadedConversations(true);

  if (!notifSt.hasLoadedFriendRequests)
    notifSt.setHasLoadedFriendRequests(true);
  if (!notifSt.hasLoadedNotifications)
    notifSt.setHasLoadedNotifications(true);

  // --- 2) KJØR ASYNKRONE KALL ----------------------
    if (chatSt.unreadConversationIds.length === 0)
      getUnreadConversationIds()
        .then(ids => chatSt.setUnreadConversationIds(ids ?? []))
        .catch(console.error);

    if (chatSt.pendingMessageRequests.length === 0)
      getPendingMessageRequests()
        .then(req => {
          chatSt.setPendingMessageRequests(req ?? []);
          chatSt.setCachedPendingRequests(req ?? []);
        })
        .catch(console.error);

    if (chatSt.conversations.length === 0)
      fetchInitialConversations().catch(console.error);

    if (notifSt.friendRequests.length === 0)
      fetchAndSetFriendRequests(token);

    fetchAndSetMessageNotifications().catch(console.error);

    if (notifSt.notifications.length === 0)
      fetchAndSetNotifications(1, 50);

  }, [token, userId]);

  return null;
}

export async function fetchInitialConversations(take = 20) {
  const skip = 0;
  const response = await getMyConversations(skip, take);
  const conversations = response?.conversations ?? [];

  const addConversation = useChatStore.getState().addConversation;
  conversations.forEach(addConversation);

  useChatStore.getState().setHasLoadedConversations(true); // ✅ flagg at de er lastet

  return conversations.length < take ? false : true;
}