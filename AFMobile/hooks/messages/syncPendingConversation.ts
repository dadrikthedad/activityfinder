// syncPendingConversation.ts
import { getPendingMessageRequestById } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";

export async function syncPendingConversation(conversationId: number, forceUpdate = false) {
  const {
    addPendingRequest,
    pendingMessageRequests,
    setPendingLockedConversationId,
    setPendingMessageRequests,
  } = useChatStore.getState();

  const alreadyExists = pendingMessageRequests.some(r => r.conversationId === conversationId);

  if (alreadyExists && !forceUpdate) {
    console.log(`⏳ Pending conversation ${conversationId} already exists, skipping`);
    return;
  }

  try {
    const request = await getPendingMessageRequestById(conversationId);
    if (request) {
      if (alreadyExists) {
        const updatedRequests = pendingMessageRequests.map(r =>
          r.conversationId === conversationId ? request : r
        );
        setPendingMessageRequests(updatedRequests);
        console.log(`✅ Updated existing pending conversation ${conversationId}`);
      } else {
        addPendingRequest(request);
        setPendingLockedConversationId(conversationId);
        console.log(`✅ Added new pending conversation ${conversationId}`);
      }
      return request;
    }
  } catch (err) {
    console.error("❌ Klarte ikke hente/oppdatere pending-samtale:", err);
  }
}
