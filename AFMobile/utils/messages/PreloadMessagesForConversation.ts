import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { getMessagesForConversation } from "@/services/messages/conversationService";


export const preloadMessagesForConversation = async (conversationId: number) => {
  const { cachedMessages, setCachedMessages } = useChatStore.getState();
  const { conversationIds } = useConversationStore.getState();
  
  if (conversationIds.has(conversationId) && !cachedMessages[conversationId]) {
    console.log(`🚀 Preloader meldinger for samtale ${conversationId}...`);
    try {
      const messages = await getMessagesForConversation(conversationId, 0, 50);
      if (messages && messages.length > 0) {
        setCachedMessages(conversationId, messages);
        console.log(`✅ Preloadet ${messages.length} meldinger for samtale ${conversationId}`);
      }
    } catch (error) {
      console.error(`❌ Kunne ikke preloade meldinger for samtale ${conversationId}:`, error);
    }
  }
};