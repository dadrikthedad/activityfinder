// services/messages/deleteConversationService.ts
import { useChatStore } from "@/store/useChatStore";

export function deleteConversationLogic(conversationId: number, isSync: boolean = false): void {
  const { 
    removeConversation, 
    setCurrentConversationId, 
    setCachedMessages, 
    clearLiveMessages,
    currentConversationId 
  } = useChatStore.getState();
  
  // Rydd opp i alle message caches
  setCachedMessages(conversationId, []);
  clearLiveMessages(conversationId);
  
  // Fjern conversation
  removeConversation(conversationId);
  
  // Sett currentConversationId til null hvis vi slettet den aktive samtalen
  if (currentConversationId === conversationId) {
    setCurrentConversationId(null);
  }
  
  const logMessage = isSync 
    ? "🔄 Conversation deletion synced:" 
    : "✅ Conversation deleted:";
  console.log(logMessage, conversationId);
}