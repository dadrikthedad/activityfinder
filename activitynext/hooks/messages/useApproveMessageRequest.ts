// Godtar en meldingsforespørsel, samt henter alle samtalene fra backend og oppdaterer useChatStore i sanntid
import { useCallback, useState } from "react";
import { approveMessageRequest } from "@/services/messages/messageService";
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { getConversationById } from "@/services/messages/conversationService";

export function useApproveMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useChatStore((state) => state.removePendingRequest);
  const addConversation = useChatStore((state) => state.addConversation);
  const setCachedMessages = useChatStore((state) => state.setCachedMessages);
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);
  const setPendingLockedConversationId = useChatStore(
    (s) => s.setPendingLockedConversationId
  );

  const approve = useCallback(
    async (senderId: number, conversationId: number) => {
      setLoading(true);
      setError(null);

      try {
        // 1) Godkjenn på API
        await approveMessageRequest(senderId);

        // 2) Hent hele samtalen fra backend
        const conversation = await getConversationById(conversationId);
        if (conversation) {
          addConversation(conversation);
        }

        // 3) Hent de siste meldingene, og cache dem
        const messages = await getMessagesForConversation(conversationId, 0, 20);
        setCachedMessages(conversationId, messages ?? []);

        // 4) Fjern pending-forespørselen
        removeRequest(conversationId);

        // 5) “Lås opp” og sett aktiv samtale
        setPendingLockedConversationId(null);
        setCurrentConversationId(conversationId);

        console.log("✅ Meldingsforespørsel godkjent og samtale lagt til:", conversationId);
      } catch (err) {
        console.error("❌ Feil ved godkjenning:", err);
        setError("Kunne ikke godkjenne forespørselen.");
      } finally {
        setLoading(false);
      }
    },
    [
      removeRequest,
      addConversation,
      setCachedMessages,
      setPendingLockedConversationId,
      setCurrentConversationId,
    ]
  );

  return { approve, loading, error };
}