import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { MessageDTO } from "@/types/MessageDTO";

// En hook som kan brukes hvor som helst for å sikre at ny samtale legges til i zustand når melding kommer
export function useConversationSyncOnMessage() {
  const { conversations, addConversation } = useChatStore();

  const syncConversation = async (message: MessageDTO) => {
    const conversationExists = conversations.some(
      (conv) => conv.id === message.conversationId
    );

    if (!conversationExists) {
      try {
        const newConversation = await getConversationById(message.conversationId);
        if (newConversation) {
          addConversation(newConversation);
        }
      } catch (error) {
        console.error("❌ Feil ved henting av samtale:", error);
      }
    }
  };

  return { syncConversation };
}