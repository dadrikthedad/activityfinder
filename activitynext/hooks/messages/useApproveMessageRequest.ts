// Godtar en meldingsforespørsel, samt henter alle samtalene fra backend og oppdaterer useChatStore i sanntid
import { useCallback, useState } from "react";
import { approveMessageRequest } from "@/services/messages/messageService";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { ConversationDTO } from "@/types/ConversationDTO";

export function useApproveMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useChatStore((state) => state.removePendingRequest);
  const addConversation = useChatStore((state) => state.addConversation);
  const setCachedMessages = useChatStore((state) => state.setCachedMessages);
  const requests = useChatStore((state) => state.pendingMessageRequests);

  const approve = useCallback(async (senderId: number, conversationId: number) => {
    setLoading(true);
    setError(null);

    try {
      await approveMessageRequest(senderId);
      const messages = await getMessagesForConversation(conversationId, 0, 20);

      const request = requests.find((r) => r.senderId === senderId && r.conversationId === conversationId);

      const newConversation: ConversationDTO = {
        id: conversationId,
        isGroup: false,
        lastMessageSentAt: new Date().toISOString(),
        participants: request ? [
          {
            id: senderId,
            fullName: request.senderName,
            profileImageUrl: request.profileImageUrl ?? null,
          }
        ] : [],
          isPendingApproval: false
      };

      addConversation(newConversation);
      setCachedMessages(conversationId, messages ?? []);
      removeRequest(conversationId);
      useChatStore.getState().setPendingLockedConversationId(null);

      console.log("✅ Meldingsforespørsel godkjent og samtale oppdatert:", {
        senderId,
        conversationId,
      });
    } catch (err) {
      console.error("❌ Feil ved godkjenning:", err);
      setError("Kunne ikke godkjenne forespørselen.");
    } finally {
      setLoading(false);
    }
  }, [removeRequest, addConversation, setCachedMessages, requests]);

  return { approve, loading, error };
}