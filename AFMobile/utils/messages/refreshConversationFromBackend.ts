// services/messages/conversationUpdateService.ts
import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { getPendingMessageRequestById } from "@/services/messages/messageService";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { MessageRequestDTO } from "@shared/types/MessageReqeustDTO";

export async function refreshConversationFromBackend(
  conversationId: number,
  logPrefix: string = "🔄"
): Promise<{ type: 'conversation'; data: ConversationDTO } | { type: 'pending'; data: MessageRequestDTO } | null> {
  console.log(`${logPrefix} Refreshing conversation ${conversationId} from backend`);
  
  const {
    conversations,
    updateConversation,
    pendingMessageRequests,
    setPendingMessageRequests,
    addConversation,
    addPendingRequest
  } = useChatStore.getState();
  
  try {
    // Prøv først å hente som vanlig samtale
    const freshConversation = await getConversationById(conversationId);
    if (freshConversation) {
      console.log(`✅ Refreshed conversation ${conversationId} from backend`);
      
      const existingConversation = conversations.find(c => c.id === conversationId);
      if (existingConversation) {
        updateConversation(conversationId, freshConversation);
      } else {
        addConversation(freshConversation);
      }
      
      return { type: 'conversation', data: freshConversation };
    }
  } catch (error) {
    console.log(`⚠️ Failed to refresh as regular conversation, trying pending: ${error}`);
  }

  try {
    // Prøv deretter å hente som pending request
    const freshPendingRequest = await getPendingMessageRequestById(conversationId);
    if (freshPendingRequest) {
      console.log(`✅ Refreshed pending request ${conversationId} from backend`);
      
      const existingPending = pendingMessageRequests.find(r => r.conversationId === conversationId);
      if (existingPending) {
        const updatedRequests = pendingMessageRequests.map(r =>
          r.conversationId === conversationId ? freshPendingRequest : r
        );
        setPendingMessageRequests(updatedRequests);
      } else {
        addPendingRequest(freshPendingRequest);
      }
      
      return { type: 'pending', data: freshPendingRequest };
    }
  } catch (error) {
    console.error(`❌ Failed to refresh conversation ${conversationId} as pending request:`, error);
  }

  console.error(`❌ Could not refresh conversation ${conversationId} from backend`);
  return null;
}