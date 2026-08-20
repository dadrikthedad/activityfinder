// syncPendingConversation.ts
import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";

export async function syncPendingConversation(conversationId: number, forceUpdate = false) {
  const {
    addPendingConversation,
    pendingConversations,
    updatePendingConversation,
  } = useConversationStore.getState();

  const { setPendingLockedConversationId } = useChatStore.getState();

  const alreadyExists = pendingConversations.some((c) => c.id === conversationId);

  if (alreadyExists && !forceUpdate) {
    console.log(`⏳ Pending conversation ${conversationId} already exists, skipping`);
    return;
  }

  try {
    // Pending-samtale hentes via samme endepunkt som vanlige samtaler (GET /api/conversation/{id}).
    const conversation = await getConversationById(conversationId);
    if (conversation) {
      if (alreadyExists) {
        updatePendingConversation(conversationId, conversation);
        console.log(`✅ Updated existing pending conversation ${conversationId}`);
      } else {
        addPendingConversation(conversation);
        setPendingLockedConversationId(conversationId);
        console.log(`✅ Added new pending conversation ${conversationId}`);
      }
      return conversation;
    }
  } catch (err) {
    console.error("❌ Klarte ikke hente/oppdatere pending-samtale:", err);
  }
}
