import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";

export function rejectMessageRequestLogic(conversationId: number, isSync: boolean = false): void {
  const { setCurrentConversationId } = useChatStore.getState();
  const { removePendingConversation, removeConversation } = useConversationStore.getState();
  
  // Fjern fra alle relevante steder i store
  removeConversation(conversationId);
  removePendingConversation(conversationId); // ✅ Riktig navn
  setCurrentConversationId(null);
  
  const logMessage = isSync 
    ? "🔄 Request rejection synced for conversation:" 
    : "❌ Request rejected for conversation:";
  console.log(logMessage, conversationId);
}