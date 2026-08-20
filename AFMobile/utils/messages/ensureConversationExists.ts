// ensureConversationExists.ts
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { getConversationById, getMessagesForConversation } from "@/services/messages/conversationService";

export const ensureConversationExists = async (conversationId: number, shouldCacheMessages = true) => {
  const { cachedMessages, setCachedMessages } = useChatStore.getState();
  const { conversationIds, pendingConversations, addConversation } = useConversationStore.getState();
  
  if (conversationIds.has(conversationId)) {
    if (shouldCacheMessages && !cachedMessages[conversationId]) {
      console.log(`💾 Proaktiv caching av meldinger for samtale ${conversationId}...`);
      try {
        const messages = await getMessagesForConversation(conversationId, 0, 50);
        if (messages && messages.length > 0) {
          setCachedMessages(conversationId, messages);
          console.log(`✅ Cachet ${messages.length} meldinger for samtale ${conversationId}`);
        }
      } catch (error) {
        console.error(`❌ Kunne ikke cache meldinger for samtale ${conversationId}:`, error);
      }
    }
    return;
  }
  
  const isPending = pendingConversations.some(
    (conversation) => conversation.id === conversationId
  );
  
  if (isPending) {
    console.log(`⏳ Samtale ${conversationId} er allerede i pending-listen, hopper over henting`);
    return;
  }
  
  console.log(`🔍 Samtale ${conversationId} finnes ikke i listen, henter den...`);
  
  try {
    const [conversation, messages] = await Promise.all([
      getConversationById(conversationId),
      shouldCacheMessages ? getMessagesForConversation(conversationId, 0, 50) : Promise.resolve(null)
    ]);
    
    if (conversation) {
      addConversation(conversation);
      console.log(`✅ Samtale ${conversationId} lagt til i listen`);
      
      if (messages && messages.length > 0 && shouldCacheMessages) {
        setCachedMessages(conversationId, messages);
        console.log(`✅ Cachet ${messages.length} meldinger for samtale ${conversationId}`);
      }
    }
  } catch (error) {
    console.error(`❌ Kunne ikke hente samtale ${conversationId}:`, error);
  }
};