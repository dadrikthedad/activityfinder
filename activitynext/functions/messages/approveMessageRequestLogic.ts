import { approveMessageRequest } from "@/services/messages/messageService";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
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
      useChatStore.getState().addConversation(unlockedConversation);
    }

    // 3) Hent de siste meldingene, og cache dem
    const messages = await getMessagesForConversation(conversationId, 0, 20);
    useChatStore.getState().setCachedMessages(conversationId, messages ?? []);

    // 4) Fjern pending-forespørselen
    useChatStore.getState().removePendingRequest(conversationId);

    // 5) Legg til i unread conversations (ikke sett som current conversation)
    const state = useChatStore.getState();
    if (!state.unreadConversationIds.includes(conversationId)) {
      state.setUnreadConversationIds([...state.unreadConversationIds, conversationId]);
    }

    // 6) Rydd opp pending state
    if (state.pendingLockedConversationId === conversationId) {
      state.setPendingLockedConversationId(null);
    }

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