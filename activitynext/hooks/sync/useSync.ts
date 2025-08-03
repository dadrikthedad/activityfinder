import { useEffect, useCallback, useState, useRef } from 'react';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useDeltaSync } from './useDeltaSync';
import { useSignalRMonitor } from './useSignalRMonitor';
import { useFallbackSync } from './useFallbackSync';
import { SyncReason } from '@/types/sync/SyncReason';

export function useSync() {
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const { syncToken } = useBootstrapStore();
  
  // Refs to prevent unnecessary re-runs
  const previousTokenRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const startupSyncDoneRef = useRef(false);
  const isInitializingRef = useRef(false); // 🆕 Prevent initialization during sync

  // Delta sync functionality
  const { performDeltaSync, initializeSyncToken } = useDeltaSync();

  // Enhanced performSync that updates lastSyncAt
  const performSyncWithTimestamp = useCallback(async (reason: SyncReason) => {
    console.log(`🔄 Starting sync (${reason})`);
    await performDeltaSync(reason);
    setLastSyncAt(new Date());
    console.log(`✅ Sync completed (${reason})`);
  }, [performDeltaSync]);

  // Fallback sync functionality
  const { isFallbackActive, startFallback, stopFallback } = useFallbackSync({
    performSync: performSyncWithTimestamp,
  });

  // SignalR connection monitoring
  const { isSignalRConnected } = useSignalRMonitor({
    onConnectionChange: (isConnected) => {
      console.log(`📡 SignalR connection changed: ${isConnected ? 'Connected' : 'Disconnected'}`);
    },
    onFallbackRequired: () => {
      console.log('⚠️ Starting fallback sync due to SignalR disconnection');
      startFallback();
    },
    onRecoveryRequired: () => {
      console.log('✅ SignalR reconnected - stopping fallback and doing recovery sync');
      stopFallback();
      // Do recovery sync when SignalR comes back
      performSyncWithTimestamp('recovery');
    }
  });

  // 1. ✅ FIXED: Initialize sync token only when it actually changes AND not during sync
  useEffect(() => {
    // 🔧 Skip if we're currently initializing (prevents loops during sync token updates)
    if (isInitializingRef.current) {
      console.log('⏸️ Skipping token initialization - currently syncing');
      return;
    }

    if (syncToken && syncToken !== previousTokenRef.current) {
      console.log('🔄 Sync token changed, initializing...');
      previousTokenRef.current = syncToken;
      initializeSyncToken(syncToken);
      isInitializedRef.current = true;
      
      // Reset startup sync flag when token changes (new user/session)
      startupSyncDoneRef.current = false;
    }
  }, [syncToken, initializeSyncToken]);

  // 2. ✅ FIXED: Initial sync only once per token, and only after proper initialization
  useEffect(() => {
    if (syncToken && 
        isInitializedRef.current && 
        !startupSyncDoneRef.current &&
        !isInitializingRef.current) { // 🔧 Don't start new sync if already syncing
      
      console.log('⏱️ Scheduling startup sync in 3 seconds...');
      const timer = setTimeout(() => {
        // 🔧 Double-check we're not syncing before starting
        if (!isInitializingRef.current && !startupSyncDoneRef.current) {
          console.log('🚀 Performing startup sync');
          isInitializingRef.current = true; // 🆕 Mark as syncing
          
          performSyncWithTimestamp('startup').finally(() => {
            isInitializingRef.current = false; // 🆕 Reset after sync
            startupSyncDoneRef.current = true; // Mark startup sync as done
          });
        } else {
          console.log('⏸️ Startup sync skipped - already syncing or done');
        }
      }, 3000);

      return () => {
        console.log('🛑 Startup sync cancelled (cleanup)');
        clearTimeout(timer);
      };
    }
  }, [syncToken, performSyncWithTimestamp]);

  // 3. ✅ OPTIMIZED: Visibility change with debouncing
  useEffect(() => {
    let visibilityTimer: NodeJS.Timeout | null = null;
    
    const handleVisibilityChange = () => {
      // Only sync if we have a token and app becomes visible
      if (!document.hidden && syncToken && isInitializedRef.current && !isInitializingRef.current) {
        // Debounce visibility changes (avoid rapid sync calls)
        if (visibilityTimer) {
          clearTimeout(visibilityTimer);
        }
        
        visibilityTimer = setTimeout(() => {
          console.log('👀 App visible - performing recovery sync');
          isInitializingRef.current = true;
          performSyncWithTimestamp('recovery').finally(() => {
            isInitializingRef.current = false;
          });
        }, 500); // 500ms debounce
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimer) {
        clearTimeout(visibilityTimer);
      }
    };
  }, [syncToken, performSyncWithTimestamp]);

  // 4. ✅ OPTIMIZED: Network status with debouncing
  useEffect(() => {
    let networkTimer: NodeJS.Timeout | null = null;
    
    const handleNetworkOnline = () => {
      if (syncToken && isInitializedRef.current && !isInitializingRef.current) {
        // Debounce network changes (avoid rapid sync calls)
        if (networkTimer) {
          clearTimeout(networkTimer);
        }
        
        networkTimer = setTimeout(() => {
          console.log('🌐 Network online - performing recovery sync');
          isInitializingRef.current = true;
          performSyncWithTimestamp('recovery').finally(() => {
            isInitializingRef.current = false;
          });
        }, 1000); // 1 second debounce for network (might take time to stabilize)
      }
    };

    window.addEventListener('online', handleNetworkOnline);
    
    return () => {
      window.removeEventListener('online', handleNetworkOnline);
      if (networkTimer) {
        clearTimeout(networkTimer);
      }
    };
  }, [syncToken, performSyncWithTimestamp]);

  // 5. ✅ OPTIMIZED: Manual sync trigger with duplicate prevention
  const triggerSync = useCallback(() => {
    if (!syncToken || !isInitializedRef.current) {
      console.warn('⚠️ Cannot trigger sync - not initialized');
      return;
    }
    
    if (isInitializingRef.current) {
      console.warn('⚠️ Cannot trigger sync - already syncing');
      return;
    }
    
    console.log('🎯 Manual sync triggered');
    isInitializingRef.current = true;
    performSyncWithTimestamp('manual').finally(() => {
      isInitializingRef.current = false;
    });
  }, [syncToken, performSyncWithTimestamp]);

  // 6. ✅ DEBUG: Log current state
  useEffect(() => {
    if (syncToken) {
      console.log('📊 Sync state:', {
        hasToken: !!syncToken,
        isInitialized: isInitializedRef.current,
        startupSyncDone: startupSyncDoneRef.current,
        isInitializing: isInitializingRef.current, // 🆕 Add this to debug
        signalRConnected: isSignalRConnected,
        fallbackActive: isFallbackActive,
        lastSyncAt: lastSyncAt?.toISOString()
      });
    }
  }, [syncToken, isSignalRConnected, isFallbackActive, lastSyncAt]);

  return {
    isSignalRConnected,
    isFallbackActive,
    lastSyncAt,
    triggerSync,
    // 🆕 Additional useful state for debugging
    isInitialized: isInitializedRef.current,
    hasToken: !!syncToken,
    isInitializing: isInitializingRef.current // 🆕 Expose for debugging
  };
}