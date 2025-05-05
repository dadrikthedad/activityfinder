// hooks/conversations/useSharedChatState.ts
import { useLocalStorage } from "../common/useLocalStorage";

export function useSharedChatState() {
  const [selectedConversationId, setSelectedConversationId] = useLocalStorage<number | null>(
    "dropdown_convo",
    null
  );

  return {
    selectedConversationId,
    setSelectedConversationId,
  };
}
