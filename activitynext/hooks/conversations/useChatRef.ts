// hooks/chat/useChatRefs.ts
import { ConversationDTO } from "@/types/ConversationDTO";

export const conversationsRef = {
  current: [] as ConversationDTO[],
};

export const hasInitializedRef = {
  current: false,
};
