import { useState, useCallback } from 'react';
import { deleteConversation } from '@/services/messages/conversationService';
import { useChatStore } from '@/store/useChatStore';

interface UseDeleteConversationResult {
  deleteConversationMutation: (conversationId: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function useDeleteConversation(): UseDeleteConversationResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  // Store actions
  const removeConversation = useChatStore((state) => state.removeConversation);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const setCachedMessages = useChatStore((state) => state.setCachedMessages);
  const clearLiveMessages = useChatStore((state) => state.clearLiveMessages);
  const currentConversationId = useChatStore((state) => state.currentConversationId);

  const deleteConversationMutation = useCallback(async (conversationId: number) => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteConversation(conversationId);
     
      if (!result) {
        throw new Error('Kunne ikke slette samtale');
      }

      // 🆕 Eksplisitt rydd opp i alle message caches først
      setCachedMessages(conversationId, []);
      clearLiveMessages(conversationId);
      
      // 🆕 Så fjern conversation (som også rydder opp, men vi er eksplisitte)
      removeConversation(conversationId);
     
      // 🆕 Sett currentConversationId til null hvis vi slettet den aktive samtalen
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
      }

      console.log('✅ Samtale og alle meldinger slettet:', result.message);
     
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'En feil oppstod ved sletting av samtale';
      setError(errorMessage);
      console.error('❌ Feil ved sletting:', err);
      throw err; // Re-throw for komponenten å håndtere
    } finally {
      setIsDeleting(false);
    }
  }, [
    removeConversation, 
    setCurrentConversationId, 
    setCachedMessages, 
    clearLiveMessages, 
    currentConversationId
  ]);

  return {
    deleteConversationMutation,
    isDeleting,
    error
  };
}