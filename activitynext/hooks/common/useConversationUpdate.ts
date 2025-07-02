// hooks/useConversationUpdate.ts - Enkel og kraftfull hook for samtale-operasjoner
import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { getPendingMessageRequestById } from "@/services/messages/messageService";
import { ConversationDTO } from "@/types/ConversationDTO";
import { MessageRequestDTO } from "@/types/MessageReqeustDTO";

export function useConversationUpdate() {
  const {
    conversations,
    updateConversation,
    pendingMessageRequests,
    setPendingMessageRequests,
    addConversation,
    addPendingRequest
  } = useChatStore();

  // 🎯 Hent ferske data fra backend og oppdater store
  const refreshConversation = async (
    conversationId: number,
    options?: {
      logPrefix?: string;
    }
  ) => {
    const { logPrefix = "🔄" } = options || {};
    
    console.log(`${logPrefix} Refreshing conversation ${conversationId} from backend`);

    try {
      // Prøv først å hente som vanlig samtale
      const freshConversation = await getConversationById(conversationId);
      if (freshConversation) {
        console.log(`✅ Refreshed conversation ${conversationId} from backend:`, {
          groupName: freshConversation.groupName,
          groupImageUrl: freshConversation.groupImageUrl,
          participants: freshConversation.participants?.length,
          lastMessageSentAt: freshConversation.lastMessageSentAt
        });
        
        // Sjekk om samtalen allerede finnes i conversations
        const existingConversation = conversations.find(c => c.id === conversationId);
        if (existingConversation) {
          // Oppdater eksisterende samtale med alle ferske data
          updateConversation(conversationId, freshConversation);
        } else {
          // Legg til ny samtale
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
        console.log(`✅ Refreshed pending request ${conversationId} from backend:`, {
          groupName: freshPendingRequest.groupName,
          groupImageUrl: freshPendingRequest.groupImageUrl,
          participants: freshPendingRequest.participants?.length
        });
        
        // Sjekk om pending request allerede finnes
        const existingPending = pendingMessageRequests.find(r => r.conversationId === conversationId);
        if (existingPending) {
          // Oppdater eksisterende pending request med alle ferske data
          const updatedRequests = pendingMessageRequests.map(r =>
            r.conversationId === conversationId ? freshPendingRequest : r
          );
          setPendingMessageRequests(updatedRequests);
        } else {
          // Legg til ny pending request
          addPendingRequest(freshPendingRequest);
        }
        
        return { type: 'pending', data: freshPendingRequest };
      }
    } catch (error) {
      console.error(`❌ Failed to refresh conversation ${conversationId} as pending request:`, error);
    }

    console.error(`❌ Could not refresh conversation ${conversationId} from backend`);
    return null;
  };

  // 🔄 Lokale oppdateringer uten backend-kall (for optimistiske updates)
  const updateConversationLocally = async (
    conversationId: number,
    updates: Partial<ConversationDTO & Pick<MessageRequestDTO, 'groupName' | 'groupImageUrl'>>,
    logPrefix = "📝"
  ) => {
    console.log(`${logPrefix} Updating conversation ${conversationId} locally:`, updates);
   
    // Oppdater i conversations hvis den finnes
    const existingConversation = conversations.find(c => c.id === conversationId);
    if (existingConversation) {
      console.log(`✅ Updated conversation ${conversationId} in conversations list`);
      updateConversation(conversationId, updates);
      return true;
    }

    // Oppdater i pending requests hvis den finnes
    const existingPendingRequest = pendingMessageRequests.find(r => r.conversationId === conversationId);
    if (existingPendingRequest) {
      console.log(`✅ Updated conversation ${conversationId} in pending requests`);
      
      // Kun oppdater egenskaper som finnes på MessageRequestDTO
      const pendingUpdates: Partial<MessageRequestDTO> = {};
      if (updates.groupName !== undefined) pendingUpdates.groupName = updates.groupName;
      if (updates.groupImageUrl !== undefined) pendingUpdates.groupImageUrl = updates.groupImageUrl;
      
      const updatedRequests = pendingMessageRequests.map(r =>
        r.conversationId === conversationId
          ? { ...r, ...pendingUpdates }
          : r
      );
      setPendingMessageRequests(updatedRequests);
      return true;
    }

    console.warn(`⚠️ Conversation ${conversationId} not found locally for update`);
    return false;
  };

  return { 
    refreshConversation,        // Hent ferske data fra backend
    updateConversationLocally,  // Lokale oppdateringer (optimistiske updates)
  };
}