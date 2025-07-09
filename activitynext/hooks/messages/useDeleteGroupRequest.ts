import { useState } from 'react';
import { deleteGroupRequest } from '@/services/messages/groupService';

export function useDeleteGroupRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteRequest = async (conversationId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await deleteGroupRequest(conversationId);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete group request';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    deleteRequest,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}