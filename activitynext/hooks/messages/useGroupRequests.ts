import { useState } from 'react';
import { SendGroupRequestsDTO, SendGroupRequestsResponseDTO } from '@/types/SendGroupRequestsDTO';
import { sendGroupRequests } from '@/services/messages/groupService';

interface UseGroupRequestsResult {
  sendGroupInvitations: (request: SendGroupRequestsDTO) => Promise<SendGroupRequestsResponseDTO | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGroupRequests(): UseGroupRequestsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendGroupInvitations = async (request: SendGroupRequestsDTO): Promise<SendGroupRequestsResponseDTO | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendGroupRequests(request);
      
      if (!response) {
        setError('Failed to send group invitations');
        return null;
      }

      console.log("✅ Gruppe-invitasjoner sendt:", response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error("❌ Feil ved sending av gruppe-invitasjoner:", errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    sendGroupInvitations,
    isLoading,
    error,
    clearError,
  };
}