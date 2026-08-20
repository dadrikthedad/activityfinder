// Godtar en meldingsforespørsel, samt henter alle samtalene fra backend og oppdaterer useChatStore i sanntid
import { useCallback, useState } from "react";
import { approveMessageRequestLogic } from "@/utils/messages/approveMessageRequestLogic";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { getConversationById } from "@/services/messages/conversationService";
import { ConversationDTO, ConversationType } from "@shared/types/ConversationDTO";
import { getOtherParticipant } from "@/features/conversation/utils/conversationHelpers";
import { LocalToastType, showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { useAuth } from "@/context/AuthContext";


// TODO: etter toast er implimentert

export function useApproveMessageRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeRequest = useConversationStore((state) => state.removePendingConversation);
  const addConversation = useConversationStore((state) => state.addConversation);
  const setPendingLockedConversationId = useChatStore((s) => s.setPendingLockedConversationId);
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
    // Fjern "venter på godkjenning"-status
    removeRequest(conversationId);

    const convStore = useConversationStore.getState();
    let convo: ConversationDTO | null =
      (convStore.conversations ?? []).find(c => c.id === conversationId) ??
      (convStore.pendingConversations ?? []).find(c => c.id === conversationId) ??
      null;

    if (!convo) {
      try {
        convo = await getConversationById(conversationId);
      } catch (err) {
        console.error("❌ Kunne ikke hente samtale for lokal godkjenning:", err);
      }
    }

    if (convo) {
      // Godkjent meldingsforespørsel blir en direkte samtale
      const updated = { ...convo, type: ConversationType.DirectChat };
      addConversation(updated);
    }

    const { unreadConversationIds, setUnreadConversationIds } = useConversationStore.getState();
    if (!unreadConversationIds.includes(conversationId)) {
      setUnreadConversationIds([...unreadConversationIds, conversationId]);
    }

    if (convo) {
      const otherParticipant = getOtherParticipant(convo, currentUserId);
      showNotificationToastNative({
        senderName: otherParticipant?.user.fullName ?? "Samtale",
        conversationId: convo.id,
        type: LocalToastType.MsgRequestAcceptedLocally, // Eller LocalToastType hvis du vil ha en egen
        relatedUser: otherParticipant?.user ?? undefined,
      });
    }

    setPendingLockedConversationId(null);
  }, [
    removeRequest,
    addConversation,
    setPendingLockedConversationId,
    currentUserId
  ]);

  return { approve, approveLocally, loading, error };
}