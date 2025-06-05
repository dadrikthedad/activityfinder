// Hjelpefunksjon som gjør at vi laster inn alt i MessageDropdown i navbaren ved at vi er innlogget.
import { useEffect } from "react";
import { fetchAndSetNotifications } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { getPendingMessageRequests } from "@/services/messages/messageService";
import { useAuth } from "@/context/AuthContext";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { getUnreadConversationIds } from "@/services/messages/messageNotificationService";

let didRunInitializer = false;

export function MessageDropdownInitializer() {
  const { userId } = useAuth();
  const {
    hasLoadedConversations,
    hasLoadedPendingRequests,
    hasLoadedUnreadConversationIds,
  } = useChatStore();

  useEffect(() => {
    if (didRunInitializer || !userId) return;
    didRunInitializer = true;

    console.log("🚀 Initializer TRIGGERED with userId =", userId);

    if (!hasLoadedUnreadConversationIds) {
      getUnreadConversationIds()
        .then((ids) => {
          useChatStore.getState().setUnreadConversationIds(ids ?? []);
          useChatStore.getState().setHasLoadedUnreadConversationIds(true);
        })
        .catch(console.error);
    }

    if (!hasLoadedPendingRequests) {
      getPendingMessageRequests()
        .then((data) => {
          useChatStore.getState().setPendingMessageRequests(data ?? []);
          useChatStore.getState().setCachedPendingRequests(data ?? []);
          useChatStore.getState().setHasLoadedPendingRequests(true);
        })
        .catch(console.error);
    }

    if (!hasLoadedConversations) {
      fetchInitialConversations().catch(console.error);
    }

    fetchAndSetNotifications().catch(console.error);
  }, [userId, hasLoadedConversations, hasLoadedPendingRequests, hasLoadedUnreadConversationIds]);

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