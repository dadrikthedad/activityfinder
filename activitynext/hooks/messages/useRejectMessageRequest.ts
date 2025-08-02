import { useCallback, useState } from "react";
import { rejectRequest } from "@/services/messages/messageService";
import { rejectMessageRequestLogic} from "@/functions/messages/rejectMesageRequestLogic";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { RejectRequestDTO } from "@/types/RejectRequestDTO";

export function useRejectMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
       
        // API kall
        await rejectRequest(dto);
        
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