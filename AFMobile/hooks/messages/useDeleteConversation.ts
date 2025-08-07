import { useState, useCallback } from 'react';
import { deleteConversation } from '@/services/messages/conversationService';
import { deleteConversationLogic } from '@/utils/messages/deleteConversationLogic';

interface UseDeleteConversationResult {
  deleteConversationMutation: (conversationId: number) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function useDeleteConversation(): UseDeleteConversationResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteConversationMutation = useCallback(async (conversationId: number) => {
    setIsDeleting(true);
    setError(null);
    
    try {
      const result = await deleteConversation(conversationId);
      
      if (!result) {
        throw new Error('Kunne ikke slette samtale');
      }
      
      // Bruk samme logikk som sync
      deleteConversationLogic(conversationId, false);
      
      console.log('✅ Samtale og alle meldinger slettet:', result.message);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'En feil oppstod ved sletting av samtale';
      setError(errorMessage);
      console.error('❌ Feil ved sletting:', err);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteConversationMutation, isDeleting, error };
}