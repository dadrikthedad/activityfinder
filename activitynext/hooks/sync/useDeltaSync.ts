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

  // 🔧 FIXED: Silent token update function (doesn't trigger store changes)
  const updateSyncTokenSilently = useCallback((newToken: string) => {
    syncTokenRef.current = newToken;
    localStorage.setItem('lastSyncToken', newToken);
    
    // 🔧 TEMPORARY: Update store without triggering watchers
    // We need a way to update the store silently to avoid infinite loops
    const currentStore = useBootstrapStore.getState();
    if (currentStore.syncToken !== newToken) {
      console.log('🔄 Updating sync token silently (no watchers triggered)');
      // Direct store update without triggering subscribers
      useBootstrapStore.setState({ syncToken: newToken }, false); // false = don't notify
    }
  }, []);

  // Main delta sync function with token management
  const performDeltaSync = useCallback(async (reason: SyncReason): Promise<void> => {
    const currentToken = syncTokenRef.current;
   
    if (!currentToken && reason !== 'startup') {
      console.warn(`⚠️ No sync token available for ${reason} sync`);
      return;
    }

    console.log(`🔄 Delta sync starting (${reason}) with token:`, currentToken?.substring(0, 20) + '...' || 'none');

    // Perform sync with retry logic
    const result = await performSyncWithRetry(currentToken, reason);
   
    if (result.success && result.newSyncToken) {
      // 🔧 Use silent update to prevent infinite loops
      updateSyncTokenSilently(result.newSyncToken);
     
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
  }, [performSyncWithRetry, updateSyncTokenSilently]);

  // Force clear sync token (for logout, user switch, etc.)
  const clearSyncToken = useCallback(() => {
    console.log('🗑️ Clearing sync token');
    syncTokenRef.current = null;
    localStorage.removeItem('lastSyncToken');
    setSyncToken(null); // 🔧 Now we can use null since store accepts it
  }, [setSyncToken]);

  return {
    performDeltaSync,
    initializeSyncToken,
    getCurrentSyncToken,
    clearSyncToken
  };
}