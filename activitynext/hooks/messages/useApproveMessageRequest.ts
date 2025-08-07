// Godtar en meldingsforespørsel, samt henter alle samtalene fra backend og oppdaterer useChatStore i sanntid
import { useCallback, useState } from "react";
import { approveMessageRequestLogic } from "@/functions/messages/approveMessageRequestLogic";
import { useChatStore } from "@/store/useChatStore";
import { getConversationById } from "@/services/messages/conversationService";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { LocalToastType, showNotificationToast } from "@/components/toast/Toast";
import { useAuth } from "@/context/AuthContext";

export function useApproveMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useChatStore((state) => state.removePendingRequest);
  const addConversation = useChatStore((state) => state.addConversation);
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);
  const setPendingLockedConversationId = useChatStore(
    (s) => s.setPendingLockedConversationId
  );
  const { userId: currentUserId } = useAuth();

  const approve = useCallback(
  async (conversationId: number, isSync: boolean = false) => {
    if (!isSync) {
      setLoading(true);
      setError(null);
    }
    try {
      await approveMessageRequestLogic(conversationId, isSync);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ukjent feil";
      console.error("❌ Feil i approve:", errorMessage);
      if (!isSync) {
        setError("Kunne ikke godkjenne forespørselen.");
      }
    } finally {
      if (!isSync) {
        setLoading(false);
      }
    }
  },
  []
);

  const approveLocally = useCallback(async (conversationId: number) => {
    const state = useChatStore.getState();

    // Fjern "venter på godkjenning"-status
    removeRequest(conversationId);

    let convo: ConversationDTO | null = state.conversations.find(c => c.id === conversationId) ?? null;

    if (!convo) {
      try {
        convo = await getConversationById(conversationId);
      } catch (err) {
        console.error("❌ Kunne ikke hente samtale for lokal godkjenning:", err);
      }
    }

    if (convo) {
      const updated = { ...convo, isPendingApproval: false };
      addConversation(updated);
    }

    if (state.pendingLockedConversationId === conversationId) {
      setCurrentConversationId(conversationId);
    } else if (!state.unreadConversationIds.includes(conversationId)) {
      state.setUnreadConversationIds([...state.unreadConversationIds, conversationId]);
    }

    if (convo) {
      const otherParticipant = convo.participants.find(p => p.id !== currentUserId); // Antatt at du har en currentUserId
      showNotificationToast({
        senderName: otherParticipant?.fullName ?? "Samtale",
        conversationId: convo.id,
        type: LocalToastType.MsgRequestAcceptedLocally, // Eller LocalToastType hvis du vil ha en egen
        relatedUser: otherParticipant ?? undefined,
      });
    }

    setPendingLockedConversationId(null);
  }, [
    removeRequest,
    addConversation,
    setCurrentConversationId,
    setPendingLockedConversationId,
    currentUserId
  ]);

  return { approve, approveLocally, loading, error };
}