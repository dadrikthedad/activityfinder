import { useCallback, useState } from "react";
import { rejectMessageRequest } from "@/services/messages/messageService";
import { useChatStore } from "@/store/useChatStore";

export function useRejectMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useChatStore((state) => state.removePendingRequest);
  const removeConversation = useChatStore((state) => state.removeConversation);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);

  const reject = useCallback(
    async (senderId: number, conversationId: number) => {
      setLoading(true);
      setError(null);

      try {
        await rejectMessageRequest(senderId);

        removeConversation(conversationId);
        setCurrentConversationId(null);
        removeRequest(conversationId); // ✅ Fjern fra pending-lista

        console.log("❌ Meldingsforespørsel avslått:", conversationId);
      } catch (err) {
        console.error("❌ Feil ved avslag:", err);
        setError("Kunne ikke avslå forespørselen.");
      } finally {
        setLoading(false);
      }
    },
    [removeRequest, removeConversation, setCurrentConversationId]
  );

  return { reject, loading, error };
}
