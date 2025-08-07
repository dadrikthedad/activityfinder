import { ConversationDTO } from "@shared/types/ConversationDTO";
import { useChatStore } from "@/store/useChatStore";

/**
 * Håndterer ny eller oppdatert samtale fra sync event
 */
export const handleConversationSync = async (
  conversation: ConversationDTO
): Promise<void> => {
  const {
    conversationIds,
    addConversation,
    removePendingRequest,
    pendingMessageRequests,
  } = useChatStore.getState();

  try {
    // 🚫 Hvis samtalen allerede finnes i hovedlisten, bare oppdater
    if (conversationIds.has(conversation.id)) {
      console.log(`🔄 Updating conversation ${conversation.id} from sync`);
      addConversation(conversation);
      return;
    }

    // 🔍 Hvis samtalen finnes i pendingRequests, flytt den over
    const existingPending = pendingMessageRequests.find(
      (r) => r.conversationId === conversation.id
    );

    if (existingPending) {
      console.log(`🟢 Promoting pending request to full conversation: ${conversation.id}`);
      removePendingRequest(conversation.id);
    }

    // ➕ Legg til samtalen i hovedlisten
    addConversation(conversation);
    console.log(`✅ Added conversation ${conversation.id} to store`);

  } catch (error) {
    console.error(`❌ Failed to handle conversation ${conversation.id} from sync:`, error);
  }
};
