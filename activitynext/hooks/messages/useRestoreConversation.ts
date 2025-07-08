import { useState, useCallback } from 'react';
import { restoreConversation } from '@/services/messages/conversationService';
import { useChatStore } from '@/store/useChatStore';
import { getConversationById, getMessagesForConversation } from '@/services/messages/conversationService';

interface UseRestoreConversationResult {
  restoreConversationMutation: (conversationId: number) => Promise<void>;
  isRestoring: boolean;
  error: string | null;
}

export function useRestoreConversation(): UseRestoreConversationResult {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store actions
  const addConversation = useChatStore((state) => state.addConversation);
  const setCachedMessages = useChatStore((state) => state.setCachedMessages);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);

  const restoreConversationMutation = useCallback(async (conversationId: number) => {
    setIsRestoring(true);
    setError(null);

    try {
      // 1) Gjenopprett på API
      const result = await restoreConversation(conversationId);
      
      if (!result) {
        throw new Error('Kunne ikke gjenopprette samtale');
      }

      // 2) Hent hele samtalen fra backend
      const conversation = await getConversationById(conversationId);
      if (conversation) {
        // Legg til samtalen i store
        addConversation(conversation);
        
        // 3) Hent de siste meldingene, og cache dem
        const messages = await getMessagesForConversation(conversationId, 0, 20);
        setCachedMessages(conversationId, messages ?? []);
        
        // 4) Sett som aktiv samtale
        setCurrentConversationId(conversationId);
      }

      console.log('✅ Samtale gjenopprettet:', result.message);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'En feil oppstod ved gjenoppretting av samtale';
      setError(errorMessage);
      console.error('❌ Feil ved gjenoppretting:', err);
      throw err; // Re-throw for komponenten å håndtere
    } finally {
      setIsRestoring(false);
    }
  }, [addConversation, setCachedMessages, setCurrentConversationId]);

  return {
    restoreConversationMutation,
    isRestoring,
    error
  };
}