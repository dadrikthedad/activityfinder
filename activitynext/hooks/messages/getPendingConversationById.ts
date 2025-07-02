// En hook som kan brukes for å legge til pending-samtale fra signalr
import { getPendingMessageRequestById } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";

export function usePendingConversationSync() {
  const {
    addPendingRequest,
    pendingMessageRequests,
    setPendingLockedConversationId,
    setPendingMessageRequests // 🆕 Trenger denne for å oppdatere eksisterende
  } = useChatStore();

  const syncPendingConversation = async (conversationId: number, forceUpdate = false) => {
    const alreadyExists = pendingMessageRequests.some(
      (r) => r.conversationId === conversationId
    );
    
    if (alreadyExists && !forceUpdate) {
      console.log(`⏳ Pending conversation ${conversationId} already exists, skipping`);
      return;
    }

    try {
      const request = await getPendingMessageRequestById(conversationId);
      if (request) {
        if (alreadyExists) {
          // 🆕 Oppdater eksisterende pending request
          const updatedRequests = pendingMessageRequests.map(r => 
            r.conversationId === conversationId ? request : r
          );
          setPendingMessageRequests(updatedRequests);
          console.log(`✅ Updated existing pending conversation ${conversationId}`);
        } else {
          // Legg til ny pending request
          addPendingRequest(request);
          setPendingLockedConversationId(conversationId);
          console.log(`✅ Added new pending conversation ${conversationId}`);
        }
        return request;
      }
    } catch (err) {
      console.error("❌ Klarte ikke hente/oppdatere pending-samtale:", err);
    }
  };

  return { syncPendingConversation };
}