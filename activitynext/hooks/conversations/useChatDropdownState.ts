// Her holder vi styr på chatten selvom vi hopper mellom sider. Brukes i ChatContext.tsx
import { useLocalStorage } from "../common/useLocalStorage";

export function useChatDropdownState() {
    const [selectedConversationId, setSelectedConversationId] = useLocalStorage<number | null>("dropdown_convo", null);
    return { selectedConversationId, setSelectedConversationId };
  }