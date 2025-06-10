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
import { fetchAndSetFriendRequests } from "@/hooks/friends/useFriendInvitations";
import { fetchAndSetNotifications } from "@/hooks/notifications/useGetNotifications";

export function MessageDropdownInitializer() {
  const { userId, token } = useAuth();
  const hasLoadedConversations       = useChatStore((s) => s.hasLoadedConversations);
  const hasLoadedPendingRequests     = useChatStore((s) => s.hasLoadedPendingRequests);
  const hasLoadedUnreadConversationIds = useChatStore((s) => s.hasLoadedUnreadConversationIds);
  const hasLoadedFriendRequests = useNotificationStore((s) => s.hasLoadedFriendRequests);
  const hasLoadedNotifications = useNotificationStore((s) => s.hasLoadedNotifications);
  
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

    /* Chat: uleste ID-er */
    if (!hasLoadedUnreadConversationIds) {
      getUnreadConversationIds()
        .then((ids) => {
          useChatStore.getState().setUnreadConversationIds(ids ?? []);
          useChatStore.getState().setHasLoadedUnreadConversationIds(true);
        })
        .catch(console.error);
    }

    /* Chat: pending requests */
    if (!hasLoadedPendingRequests) {
      getPendingMessageRequests()
        .then((data) => {
          useChatStore.getState().setPendingMessageRequests(data ?? []);
          useChatStore.getState().setCachedPendingRequests(data ?? []);
          useChatStore.getState().setHasLoadedPendingRequests(true);
        })
        .catch(console.error);
    }
    /* Chat: samtaler */
    if (!hasLoadedConversations) {
      fetchInitialConversations().catch(console.error);
    }

    /* Friend-requests */
    if (!hasLoadedFriendRequests && token) {
      fetchAndSetFriendRequests(token);
    }
    
    /* Evt. egne chat-notifikasjoner før SignalR */
    fetchAndSetMessageNotifications().catch(console.error);

        /* Notifikasjoner (vanlige) */
    if (!hasLoadedNotifications) {
      fetchAndSetNotifications(1, 50).then(() =>
        useNotificationStore.getState().setHasLoadedNotifications(true),
      );
    }

    }, [
    token,
    userId,
    hasLoadedConversations,
    hasLoadedPendingRequests,
    hasLoadedUnreadConversationIds,
    hasLoadedFriendRequests,
    hasLoadedNotifications,
  ]);

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