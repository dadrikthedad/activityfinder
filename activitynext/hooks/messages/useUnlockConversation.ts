// Brukes for å låse opp en samtale som er pending
import { useChatStore } from "@/store/useChatStore";

export function useUnlockConversation() {
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);
  const setPendingLockedConversationId = useChatStore((s) => s.setPendingLockedConversationId);

  return (conversationId: number) => {
    setPendingLockedConversationId(null);
    setCurrentConversationId(conversationId);
  };
}