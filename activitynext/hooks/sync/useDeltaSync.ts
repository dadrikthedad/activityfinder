// hooks/sync/useDeltaSync.ts - Simplified to focus on token management
import { useCallback, useRef } from 'react';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { SyncReason } from '@/types/sync/SyncReason';
import { useSyncApi } from './useSyncAPI';

export function useDeltaSync() {
  const { setSyncToken } = useBootstrapStore();
  const syncTokenRef = useRef<string | null>(null);
  const { performSyncWithRetry } = useSyncApi();

  // Initialize sync token from bootstrap
  const initializeSyncToken = useCallback((token: string) => {
    syncTokenRef.current = token;
    console.log('🔄 Sync token initialized:', token.substring(0, 20) + '...');
  }, []);

  // Get current sync token
  const getCurrentSyncToken = useCallback(() => {
    return syncTokenRef.current;
  }, []);

  // Main delta sync function with token management
  const performDeltaSync = useCallback(async (reason: SyncReason): Promise<void> => {
    const currentToken = syncTokenRef.current;
    
    if (!currentToken && reason !== 'startup') {
      console.warn(`⚠️ No sync token available for ${reason} sync`);
      return;
    }

    // Perform sync with retry logic
    const result = await performSyncWithRetry(currentToken, reason);
    
    if (result.success && result.newSyncToken) {
      // Update sync token
      syncTokenRef.current = result.newSyncToken;
      setSyncToken(result.newSyncToken);
      localStorage.setItem('lastSyncToken', result.newSyncToken);
      
      console.log(`✅ Sync token updated:`, {
        reason,
        eventsProcessed: result.eventsProcessed,
        retries: result.retries,
        tokenPreview: result.newSyncToken.substring(0, 20) + '...'
      });
    } else if (!result.success) {
      console.error(`❌ Delta sync failed:`, {
        reason,
        error: result.error,
        retries: result.retries
      });
    }
  }, [performSyncWithRetry, setSyncToken]);

  // Force clear sync token (for logout, user switch, etc.)
  const clearSyncToken = useCallback(() => {
    console.log('🗑️ Clearing sync token');
    syncTokenRef.current = null;
    localStorage.removeItem('lastSyncToken');
  }, []);

  return {
    performDeltaSync,
    initializeSyncToken,
    getCurrentSyncToken,
    clearSyncToken
  };
}