import { ConversationDTO } from "@shared/types/ConversationDTO";
import { useConversationStore } from "@/store/useConversationStore";

/**
 * Håndterer ny eller oppdatert samtale fra sync event
 */
export const handleConversationSync = async (
  conversation: ConversationDTO
): Promise<void> => {
  const {
    conversationIds,
    addConversation,
    removePendingConversation,
    pendingConversations,
  } = useConversationStore.getState();

  try {
    // 🚫 Hvis samtalen allerede finnes i hovedlisten, bare oppdater
    if (conversationIds.has(conversation.id)) {
      console.log(`🔄 Updating conversation ${conversation.id} from sync`);
      addConversation(conversation);
      return;
    }

    // 🔍 Hvis samtalen finnes i pending-listen, flytt den over
    const existingPending = pendingConversations.find(
      (c) => c.id === conversation.id
    );

    if (existingPending) {
      console.log(`🟢 Promoting pending conversation to full conversation: ${conversation.id}`);
      removePendingConversation(conversation.id);
    }

    // ➕ Legg til samtalen i hovedlisten
    addConversation(conversation);
    console.log(`✅ Added conversation ${conversation.id} to store`);

  } catch (error) {
    console.error(`❌ Failed to handle conversation ${conversation.id} from sync:`, error);
  }
};
