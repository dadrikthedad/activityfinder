import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { MessageDTO } from "@/types/MessageDTO";

// En hook som kan brukes hvor som helst for å sikre at ny samtale legges til i zustand når melding kommer
type SyncInput = { conversationId: number } | MessageDTO;

export function useConversationSyncOnMessage() {
  const { conversations, addConversation } = useChatStore();

  const syncConversation = async (input: SyncInput) => {
    const conversationId = input.conversationId;

    const conversationExists = conversations.some((c) => c.id === conversationId);
    if (!conversationExists) {
      try {
        const newConversation = await getConversationById(conversationId);
        if (newConversation) {
          addConversation(newConversation);
          return newConversation;
        }
      } catch (error) {
        console.error("❌ Feil ved henting av samtale:", error);
      }
    } else {
      return conversations.find((c) => c.id === conversationId);
    }
  };

  return { syncConversation };
}