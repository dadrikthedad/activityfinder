// services/messages/restoreConversationService.ts
import { useChatStore } from "@/store/useChatStore";
import { getConversationById, getMessagesForConversation } from "@/services/messages/conversationService";

export async function restoreConversationLogic(conversationId: number, isSync: boolean = false): Promise<void> {
  const { addConversation, setCachedMessages, setCurrentConversationId } = useChatStore.getState();
  
  try {
    // Hent hele samtalen fra backend
    const conversation = await getConversationById(conversationId);
    if (conversation) {
      // Legg til samtalen i store
      addConversation(conversation);
      
      // Hent de siste meldingene, og cache dem
      const messages = await getMessagesForConversation(conversationId, 0, 20);
      setCachedMessages(conversationId, messages ?? []);
      
      // Sett som aktiv samtale (kun for manuell restore, ikke sync)
      if (!isSync) {
        setCurrentConversationId(conversationId);
      }
    }
    
    const logMessage = isSync 
      ? "🔄 Conversation restoration synced:" 
      : "✅ Conversation restored:";
    console.log(logMessage, conversationId);
    
  } catch (err) {
    const errorMessage = isSync 
      ? "❌ Failed to sync conversation restoration:" 
      : "❌ Failed to restore conversation:";
    console.error(errorMessage, err);
    throw err;
  }
}