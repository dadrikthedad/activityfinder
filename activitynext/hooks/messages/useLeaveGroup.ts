import { useState } from 'react';
import { leaveGroup } from '@/services/messages/groupService';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';

interface UseLeaveGroupReturn {
  leaveGroupMutation: (conversationId: number) => Promise<void>;
  isLeavingGroup: boolean;
  error: string | null;
}

export function useLeaveGroup(): UseLeaveGroupReturn {
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🆕 Store actions - samme som useRejectMessageRequest
  const removeConversation = useChatStore((state) => state.removeConversation);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const updateNotificationsForRejectedConversation = useMessageNotificationStore(
    (state) => state.updateNotificationsForRejectedConversation
  );

  const leaveGroupMutation = async (conversationId: number): Promise<void> => {
    if (isLeavingGroup) return; // Prevent double calls

    setIsLeavingGroup(true);
    setError(null);

    try {
     // Hvis brukeren er i denne samtalen, naviger bort
     if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
     }

      const result = await leaveGroup(conversationId);
      
      if (result) {
        // 🆕 Oppdater store - samme pattern som reject
        removeConversation(conversationId);
        
        
        
        // 🆕 Oppdater notifikasjoner for denne samtalen (mark som rejected/disbanded)
        updateNotificationsForRejectedConversation(conversationId);
        console.log("✅ Successfully left group and updated store:", conversationId);
      } else {
        throw new Error('Failed to leave group - no response');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave group';
      setError(errorMessage);
      console.error("❌ Error leaving group:", err);
      throw err; // Re-throw så komponenten kan håndtere det
    } finally {
      setIsLeavingGroup(false);
    }
  };

  return {
    leaveGroupMutation,
    isLeavingGroup,
    error,
  };
}