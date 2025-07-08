import { useState, useEffect } from 'react';
import { getDeletedConversations } from '@/services/messages/conversationService';
import { ConversationDTO } from '@/types/ConversationDTO';

interface UseGetDeletedConversationsResult {
  deletedConversations: ConversationDTO[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGetDeletedConversations(): UseGetDeletedConversationsResult {
  const [deletedConversations, setDeletedConversations] = useState<ConversationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeletedConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const conversations = await getDeletedConversations();
      setDeletedConversations(conversations ?? []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke hente slettede samtaler';
      setError(errorMessage);
      console.error('❌ Feil ved henting av slettede samtaler:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedConversations();
  }, []);

  return {
    deletedConversations,
    isLoading,
    error,
    refetch: fetchDeletedConversations
  };
}