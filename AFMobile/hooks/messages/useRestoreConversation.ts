import { useState, useCallback } from 'react';
import { restoreConversation } from '@/services/messages/conversationService';
import { restoreConversationLogic } from '@/utils/messages/restoreConversationLogic';

interface UseRestoreConversationResult {
  restoreConversationMutation: (conversationId: number) => Promise<void>;
  isRestoring: boolean;
  error: string | null;
}

export function useRestoreConversation(): UseRestoreConversationResult {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restoreConversationMutation = useCallback(async (conversationId: number) => {
    setIsRestoring(true);
    setError(null);
    
    try {
      // 1) Gjenopprett på API først
      const result = await restoreConversation(conversationId);
      
      if (!result) {
        throw new Error('Kunne ikke gjenopprette samtale');
      }
      
      // 2) Bruk samme logikk som sync (men med setCurrentConversationId)
      await restoreConversationLogic(conversationId, false);
      
      console.log('✅ Samtale gjenopprettet:', result.message);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'En feil oppstod ved gjenoppretting av samtale';
      setError(errorMessage);
      console.error('❌ Feil ved gjenoppretting:', err);
      throw err;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  return { restoreConversationMutation, isRestoring, error };
}