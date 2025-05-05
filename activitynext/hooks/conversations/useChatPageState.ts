// Her holder vi styr på siden ChatPage, men kun når den rendres. Brukes i ChatContext.tsx
import { useState } from "react";

export function useChatPageState() {
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
    return { selectedConversationId, setSelectedConversationId };
  }