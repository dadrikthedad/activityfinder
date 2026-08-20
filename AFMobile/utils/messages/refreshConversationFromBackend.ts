// utils/messages/refreshConversationFromBackend.ts
import { getConversationById } from "@/services/messages/conversationService";
import { useConversationStore } from "@/store/useConversationStore";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { isPendingConversation } from "@/features/conversation/utils/conversationHelpers";

// Henter ferske samtaledata fra backend og legger dem i riktig liste (vanlig vs pending).
// Pending-samtaler hentes via samme endepunkt som vanlige (GET /api/conversation/{id});
// pending utledes av ConversationType.PendingRequest.
export async function refreshConversationFromBackend(
  conversationId: number,
  logPrefix: string = "🔄"
): Promise<{ type: 'conversation' | 'pending'; data: ConversationDTO } | null> {
  console.log(`${logPrefix} Refreshing conversation ${conversationId} from backend`);

  const {
    conversations,
    updateConversation,
    addConversation,
    pendingConversations,
    addPendingConversation,
    updatePendingConversation,
  } = useConversationStore.getState();

  try {
    const fresh = await getConversationById(conversationId);
    if (!fresh) {
      console.error(`❌ Could not refresh conversation ${conversationId} from backend`);
      return null;
    }

    if (isPendingConversation(fresh)) {
      console.log(`✅ Refreshed pending conversation ${conversationId} from backend`);
      const existingPending = pendingConversations.find((c) => c.id === conversationId);
      if (existingPending) {
        updatePendingConversation(conversationId, fresh);
      } else {
        addPendingConversation(fresh);
      }
      return { type: 'pending', data: fresh };
    }

    console.log(`✅ Refreshed conversation ${conversationId} from backend`);
    const existing = conversations.find((c) => c.id === conversationId);
    if (existing) {
      updateConversation(conversationId, fresh);
    } else {
      addConversation(fresh);
    }
    return { type: 'conversation', data: fresh };
  } catch (error) {
    console.error(`❌ Failed to refresh conversation ${conversationId} from backend:`, error);
    return null;
  }
}
