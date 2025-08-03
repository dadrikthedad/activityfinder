// hooks/useBlockUser.ts
import { useState } from 'react';
import { blockUser } from '@/services/block/blockService';
import { useUserCacheStore } from '@/store/useUserCacheStore'; 

export function useBlockUser() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlockUser = async (userId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await blockUser(userId);
      
      if (response) {
        // ✅ Oppdater store etter vellykket API kall
        const { updateUser } = useUserCacheStore.getState();
        updateUser(userId, { isBlocked: true });
        console.log('✅ Updated local store: user blocked');
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to block user';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    blockUser: handleBlockUser,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}

