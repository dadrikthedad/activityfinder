// En hook som kan brukes for å legge til pending-samtale fra signalr
import { getPendingMessageRequestById } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";

export function usePendingConversationSync() {
  const {
    addPendingRequest,
    pendingMessageRequests,
    setPendingLockedConversationId
  } = useChatStore();

  const syncPendingConversation = async (conversationId: number) => {
    const alreadyExists = pendingMessageRequests.some(
      (r) => r.conversationId === conversationId
    );
    if (alreadyExists) return;

    try {
      const request = await getPendingMessageRequestById(conversationId);
      if (request) {
        addPendingRequest(request);
        setPendingLockedConversationId(conversationId);
        return request;
      }
    } catch (err) {
      console.error("❌ Klarte ikke hente pending-samtale:", err);
    }
  };

  return { syncPendingConversation };
}