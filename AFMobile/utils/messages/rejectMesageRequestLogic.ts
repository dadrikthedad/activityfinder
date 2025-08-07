import { useChatStore } from "@/store/useChatStore";

export function rejectMessageRequestLogic(conversationId: number, isSync: boolean = false): void {
  const { removePendingRequest, removeConversation, setCurrentConversationId } = useChatStore.getState();
  
  // Fjern fra alle relevante steder i store
  removeConversation(conversationId);
  removePendingRequest(conversationId); // ✅ Riktig navn
  setCurrentConversationId(null);
  
  const logMessage = isSync 
    ? "🔄 Request rejection synced for conversation:" 
    : "❌ Request rejected for conversation:";
  console.log(logMessage, conversationId);
}