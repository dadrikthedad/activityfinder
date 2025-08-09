import { useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { SyncReason } from '@shared/types/sync/SyncReason';
import { useSyncApiNative } from './useSyncAPINative';

export function useDeltaSyncNative() {
  const { setSyncToken } = useBootstrapStore();
  const syncTokenRef = useRef<string | null>(null);
  const { performSyncWithRetry } = useSyncApiNative();

  // Initialize sync token from bootstrap
  const initializeSyncToken = useCallback((token: string) => {
    syncTokenRef.current = token;
    console.log('🔄 Sync token initialized:', token.substring(0, 20) + '...');
  }, []);

  // Get current sync token
  const getCurrentSyncToken = useCallback(() => {
    return syncTokenRef.current;
  }, []);

  // 🔧 REACT NATIVE: Silent token update function (AsyncStorage instead of localStorage)
  const updateSyncTokenSilently = useCallback(async (newToken: string) => {
    syncTokenRef.current = newToken;
    
    // React Native: Use AsyncStorage instead of localStorage
    try {
      await AsyncStorage.setItem('lastSyncToken', newToken);
    } catch (error) {
      console.warn('⚠️ Failed to save sync token to AsyncStorage:', error);
    }
   
    // Update store without triggering watchers
    const currentStore = useBootstrapStore.getState();
    if (currentStore.syncToken !== newToken) {
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
    
    // Perform sync with retry logic
    const result = await performSyncWithRetry(currentToken, reason);
   
    if (result.success && result.newSyncToken) {
      // Use silent update to prevent infinite loops
      await updateSyncTokenSilently(result.newSyncToken);
     
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

  // React Native: Force clear sync token (AsyncStorage instead of localStorage)
  const clearSyncToken = useCallback(async () => {
    console.log('🗑️ Clearing sync token');
    syncTokenRef.current = null;
    
    try {
      await AsyncStorage.removeItem('lastSyncToken');
    } catch (error) {
      console.warn('⚠️ Failed to remove sync token from AsyncStorage:', error);
    }
    
    setSyncToken(null);
  }, [setSyncToken]);

  return {
    performDeltaSync,
    initializeSyncToken,
    getCurrentSyncToken,
    clearSyncToken
  };
}