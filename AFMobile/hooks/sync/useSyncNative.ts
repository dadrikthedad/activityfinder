import { useEffect, useCallback, useState, useRef } from 'react';
import { AppState} from 'react-native';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useDeltaSyncNative } from './useDeltaSyncNative';
import { useSignalRMonitorNative } from './useSignalRMonitorNative';
import { useFallbackSyncNative } from './useFallbackSyncNative';
import { SyncReason } from '@shared/types/sync/SyncReason';
import NetInfo from '@react-native-community/netinfo';

export function useSyncNative() {
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const { syncToken } = useBootstrapStore();
  
  // Refs to prevent unnecessary re-runs
  const previousTokenRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const startupSyncDoneRef = useRef(false);
  const isInitializingRef = useRef(false);

  // Delta sync functionality
  const { performDeltaSync, initializeSyncToken } = useDeltaSyncNative();

  // Enhanced performSync that updates lastSyncAt
  const performSyncWithTimestamp = useCallback(async (reason: SyncReason) => {
    console.log(`🔄 Starting sync (${reason})`);
    await performDeltaSync(reason);
    setLastSyncAt(new Date());
    console.log(`✅ Sync completed (${reason})`);
  }, [performDeltaSync]);

  // Fallback sync functionality
  const { isFallbackActive, startFallback, stopFallback } = useFallbackSyncNative({
    performSync: performSyncWithTimestamp,
  });

  // SignalR connection monitoring
  const { isSignalRConnected } = useSignalRMonitorNative({
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
      performSyncWithTimestamp('recovery');
    }
  });

  // 1. Initialize sync token only when it actually changes AND not during sync
  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('⏸️ Skipping token initialization - currently syncing');
      return;
    }

    if (syncToken && syncToken !== previousTokenRef.current) {
      console.log('🔄 Sync token changed, initializing...');
      previousTokenRef.current = syncToken;
      initializeSyncToken(syncToken);
      isInitializedRef.current = true;
      
      startupSyncDoneRef.current = false;
    }
  }, [syncToken, initializeSyncToken]);

  // 2. Initial sync only once per token, and only after proper initialization
  useEffect(() => {
    if (syncToken && 
        isInitializedRef.current && 
        !startupSyncDoneRef.current &&
        !isInitializingRef.current) {
      
      console.log('⏱️ Scheduling startup sync in 3 seconds...');
      const timer = setTimeout(() => {
        if (!isInitializingRef.current && !startupSyncDoneRef.current) {
          console.log('🚀 Performing startup sync');
          isInitializingRef.current = true;
          
          performSyncWithTimestamp('startup').finally(() => {
            isInitializingRef.current = false;
            startupSyncDoneRef.current = true;
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

  // 3. React Native: AppState change handler (erstatter document.visibilitychange)
  useEffect(() => {
    let appStateTimer: NodeJS.Timeout | null = null;
    
    const handleAppStateChange = (nextAppState: string) => {
      // Only sync when app becomes active (equivalent to document visible)
      if (nextAppState === 'active' && syncToken && isInitializedRef.current && !isInitializingRef.current) {
        if (appStateTimer) {
          clearTimeout(appStateTimer);
        }
        
        appStateTimer = setTimeout(() => {
          console.log('👀 App became active - performing recovery sync');
          isInitializingRef.current = true;
          performSyncWithTimestamp('recovery').finally(() => {
            isInitializingRef.current = false;
          });
        }, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      if (appStateTimer) {
        clearTimeout(appStateTimer);
      }
    };
  }, [syncToken, performSyncWithTimestamp]);

  // 4. React Native: NetInfo for network status (erstatter window.addEventListener('online'))
  useEffect(() => {
    let networkTimer: NodeJS.Timeout | null = null;
    
    const handleNetworkChange = (state: any) => {
      // Only sync when network becomes connected
      if (state.isConnected && syncToken && isInitializedRef.current && !isInitializingRef.current) {
        if (networkTimer) {
          clearTimeout(networkTimer);
        }
        
        networkTimer = setTimeout(() => {
          console.log('🌐 Network connected - performing recovery sync');
          isInitializingRef.current = true;
          performSyncWithTimestamp('recovery').finally(() => {
            isInitializingRef.current = false;
          });
        }, 1000);
      }
    };

    // React Native: Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    
    return () => {
      unsubscribe();
      if (networkTimer) {
        clearTimeout(networkTimer);
      }
    };
  }, [syncToken, performSyncWithTimestamp]);

  // 5. Manual sync trigger with duplicate prevention
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

  // 6. Debug logging
  useEffect(() => {
    if (syncToken) {
      console.log('📊 Sync state:', {
        hasToken: !!syncToken,
        isInitialized: isInitializedRef.current,
        startupSyncDone: startupSyncDoneRef.current,
        isInitializing: isInitializingRef.current,
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
    isInitialized: isInitializedRef.current,
    hasToken: !!syncToken,
    isInitializing: isInitializingRef.current
  };
}