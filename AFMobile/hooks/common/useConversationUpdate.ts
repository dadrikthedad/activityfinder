import { refreshConversationFromBackend } from "@/utils/messages/refreshConversationFromBackend";

export function useConversationUpdate() {
  // 🎯 Hent ferske data fra backend og oppdater store
  const refreshConversation = async (
    conversationId: number,
    options?: {
      logPrefix?: string;
    }
  ) => {
    const { logPrefix = "🔄" } = options || {};
    
    // Bruk den nye servicen
    return await refreshConversationFromBackend(conversationId, logPrefix);
  };

  return {
    refreshConversation,
  };
}