import { useCallback, useState } from "react";
import { rejectRequest } from "@/services/messages/messageService";
import { rejectMessageRequestLogic } from "@/utils/messages/rejectMesageRequestLogic";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export function useRejectMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateNotificationsForRejectedConversation = useMessageNotificationStore(
    (state) => state.updateNotificationsForRejectedConversation
  );

  // Backend rejecter alltid på conversationId. Gruppe-reject (eget endepunkt
  // i GroupConversationController) tas i gruppe-batchen.
  const reject = useCallback(
    async (conversationId: number) => {
      setLoading(true);
      setError(null);

      try {
        // API kall — backend: POST /api/conversation/{conversationId}/reject
        await rejectRequest(conversationId);

        // UI oppdateringer (gjenbrukbar logikk)
        rejectMessageRequestLogic(conversationId, false);
        
        // Notification cleanup (kun for manuell reject)
        updateNotificationsForRejectedConversation(conversationId);
        
      } catch (err) {
        console.error("❌ Feil ved avslag:", err);
        setError("Kunne ikke avslå forespørselen.");
      } finally {
        setLoading(false);
      }
    },
    [updateNotificationsForRejectedConversation]
  );

  return { reject, loading, error };
}