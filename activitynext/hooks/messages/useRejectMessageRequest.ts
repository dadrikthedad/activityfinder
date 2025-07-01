import { useCallback, useState } from "react";
import { rejectRequest } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { RejectRequestDTO } from "@/types/RejectRequestDTO";

export function useRejectMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useChatStore((state) => state.removePendingRequest);
  const removeConversation = useChatStore((state) => state.removeConversation);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);

  const updateNotificationsForRejectedConversation = useMessageNotificationStore(
    (state) => state.updateNotificationsForRejectedConversation
  );

  const reject = useCallback(
    async (senderId: number, conversationId: number, isGroupRequest: boolean = false) => {
      setLoading(true);
      setError(null);

      try {

        const dto: RejectRequestDTO = {
          senderId,
          conversationId: isGroupRequest ? conversationId : undefined
        };
        
        await rejectRequest(dto);

        removeConversation(conversationId);
        setCurrentConversationId(null);
        removeRequest(conversationId); // ✅ Fjern fra pending-lista

        // Oppdater notifikasjoner for denne samtalen
        updateNotificationsForRejectedConversation(conversationId);

        const requestType = isGroupRequest ? "Gruppeforespørsel" : "Meldingsforespørsel";
        console.log(`❌ ${requestType} avslått:`, conversationId);
      } catch (err) {
        console.error("❌ Feil ved avslag:", err);
        setError("Kunne ikke avslå forespørselen.");
      } finally {
        setLoading(false);
      }
    },
    [removeRequest, removeConversation, setCurrentConversationId, updateNotificationsForRejectedConversation]
  );

  return { reject, loading, error };
}
