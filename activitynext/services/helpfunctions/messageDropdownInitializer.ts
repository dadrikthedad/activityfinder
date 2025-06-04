// Hjelpefunksjon som gjør at vi laster inn alt i MessageDropdown i navbaren ved at vi er innlogget.
import { useEffect } from "react";
import { fetchAndSetNotifications } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { getPendingMessageRequests } from "@/services/messages/messageService";
import { useAuth } from "@/context/AuthContext";
import { getMyConversations } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";

export function MessageDropdownInitializer() {
  const { userId } = useAuth();


  useEffect(() => {
    if (!userId) return;

    fetchAndSetNotifications().catch(console.error);

    getPendingMessageRequests()
    .then((data) => {
      useChatStore.getState().setPendingMessageRequests(data ?? []);
      useChatStore.getState().setCachedPendingRequests(data ?? []);
    })
    .catch((err) => {
      console.error("❌ Feil ved lasting av pending forespørsler:", err);
    });

    fetchInitialConversations().catch(console.error);
}, [userId]);

  return null;
}

export async function fetchInitialConversations(take = 20) {
  const skip = 0;
  const response = await getMyConversations(skip, take);
  const conversations = response?.conversations ?? [];

  const addConversation = useChatStore.getState().addConversation;
  conversations.forEach(addConversation);

  return conversations.length < take ? false : true;
}