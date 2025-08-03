// hooks/useUnblockUser.ts
import { useState } from 'react';
import { unblockUser } from '@/services/block/blockService';
import { useUserCacheStore } from '@/store/useUserCacheStore'; 

export function useUnblockUser() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnblockUser = async (userId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await unblockUser(userId);
      
      if (response) {
        // ✅ Oppdater store etter vellykket API kall
        const { updateUser } = useUserCacheStore.getState();
        updateUser(userId, { isBlocked: false });
        console.log('✅ Updated local store: user unblocked');
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unblock user';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    unblockUser: handleUnblockUser,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}