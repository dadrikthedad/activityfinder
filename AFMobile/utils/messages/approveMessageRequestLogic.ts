import { approveMessageRequest } from "@/services/messages/messageService";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { getConversationById } from "@/services/messages/conversationService";

export async function approveMessageRequestLogic(
  conversationId: number, 
  isSync: boolean = false
): Promise<void> {
  try {
    // 1) Kun gjør API kall hvis det ikke er sync
    if (!isSync) {
      await approveMessageRequest(conversationId);
    }

    // 2) Hent hele samtalen fra backend
    const conversation = await getConversationById(conversationId);
    if (conversation) {
      const unlockedConversation = { ...conversation, isPendingApproval: false };
      useConversationStore.getState().addConversation(unlockedConversation);
    }

    // 3) Hent de siste meldingene, og cache dem
    const messages = await getMessagesForConversation(conversationId, 0, 20);
    useChatStore.getState().setCachedMessages(conversationId, messages ?? []);

    // 4) Fjern pending-forespørselen
    useConversationStore.getState().removePendingConversation(conversationId);

    const chatState = useChatStore.getState();
    const convState = useConversationStore.getState();
    const pendingId = chatState.pendingLockedConversationId;
    if (pendingId === conversationId) {
      chatState.setCurrentConversationId(conversationId);
    } else {
      if (!convState.unreadConversationIds.includes(conversationId)) {
        convState.setUnreadConversationIds([...convState.unreadConversationIds, conversationId]);
      }
    }

    // 5) "Lås opp" og sett aktiv samtal
    chatState.setPendingLockedConversationId(null);

    const logMessage = isSync 
      ? "✅ Meldingsforespørsel godkjenning synkronisert:" 
      : "✅ Meldingsforespørsel godkjent og samtale lagt til:";
    console.log(logMessage, conversationId);

  } catch (err) {
    const errorMessage = isSync 
      ? "❌ Feil ved synkronisering av godkjenning:" 
      : "❌ Feil ved godkjenning:";
    console.error(errorMessage, err);
    throw err; // Re-throw for error handling
  }
}