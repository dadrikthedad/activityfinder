import { useState, useEffect } from 'react';
import { getRejectedConversations } from '@/services/messages/conversationService';
import { ConversationDTO } from '@shared/types/ConversationDTO';

interface UseGetRejectedConversationsResult {
  rejectedConversations: ConversationDTO[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGetRejectedConversations(): UseGetRejectedConversationsResult {
  const [rejectedConversations, setRejectedConversations] = useState<ConversationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRejectedConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const conversations = await getRejectedConversations();
      setRejectedConversations(conversations ?? []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke hente avslåtte samtaler';
      setError(errorMessage);
      console.error('❌ Feil ved henting av avslåtte samtaler:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRejectedConversations();
  }, []);

  return {
    rejectedConversations,
    isLoading,
    error,
    refetch: fetchRejectedConversations
  };
}