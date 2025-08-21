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
  
  // 🔧 NEW: Global debouncing for recovery syncs (from old version)
  const lastRecoveryRef = useRef<number>(0);
  const RECOVERY_DEBOUNCE_MS = 5000;
  
  // 🔧 ADDITIONAL: Global debouncing for ALL sync operations
  const lastSyncRef = useRef<number>(0);
  const GLOBAL_SYNC_DEBOUNCE_MS = 2000;
  
  // Delta sync functionality
  const { performDeltaSync, initializeSyncToken } = useDeltaSyncNative();

  // 🔧 NEW: Global debounced recovery sync function (from old version)
  const performRecoverySync = useCallback(async (source: 'appstate' | 'network' | 'signalr', force = false) => {
    if (isInitializingRef.current) {
      console.log(`⏸️ ${source} recovery sync skipped - already syncing`);
      return;
    }
    
    // 🔧 SignalR reconnect is critical and should never be debounced
    if (!force && source !== 'signalr') {
      const now = Date.now();
      if (now - lastRecoveryRef.current < RECOVERY_DEBOUNCE_MS) {
        console.log(`⏸️ ${source} recovery sync debounced (${now - lastRecoveryRef.current}ms since last recovery)`);
        return;
      }
    }
    
    // Update global recovery timestamp
    lastRecoveryRef.current = Date.now();
    
    console.log(`👀 ${source} recovery sync starting${force ? ' (forced)' : ''}`);
    isInitializingRef.current = true;
    
    try {
      await performDeltaSync('recovery');
      setLastSyncAt(new Date());
      console.log(`✅ Recovery sync completed (${source})`);
    } finally {
      isInitializingRef.current = false;
    }
  }, [performDeltaSync]);

  // 🔧 IMPROVED: Global debounced sync function for other sync types
  const performSyncWithDebouncing = useCallback(async (reason: SyncReason, source?: string, force = false) => {
    // Alltid sjekk om vi allerede syncer
    if (isInitializingRef.current) {
      console.log(`⏸️ ${reason} sync skipped - already syncing (source: ${source || 'unknown'})`);
      return;
    }
    
    // Global debouncing for alle syncs unntatt startup og forced
    if (!force && reason !== 'startup') {
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncRef.current;
      if (timeSinceLastSync < GLOBAL_SYNC_DEBOUNCE_MS) {
        console.log(`⏸️ ${reason} sync debounced - ${timeSinceLastSync}ms since last sync (source: ${source || 'unknown'})`);
        return;
      }
    }
    
    // Update global sync timestamp
    lastSyncRef.current = Date.now();
    
    console.log(`🔄 Starting sync (${reason})${source ? ` from ${source}` : ''}`);
    isInitializingRef.current = true;
    
    try {
      await performDeltaSync(reason);
      setLastSyncAt(new Date());
      console.log(`✅ Sync completed (${reason})${source ? ` from ${source}` : ''}`);
    } finally {
      isInitializingRef.current = false;
    }
  }, [performDeltaSync]);

  // Fallback sync functionality
  const { isFallbackActive, startFallback, stopFallback } = useFallbackSyncNative({
    performSync: (reason) => performSyncWithDebouncing(reason, 'fallback'),
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
      // 🔧 Use dedicated recovery function (from old version)
      performRecoverySync('signalr');
    }
  });

  // 1. Initialize sync token only when it actually changes AND not during sync
  useEffect(() => {
    if (isInitializingRef.current) {
      return;
    }

    if (syncToken && syncToken !== previousTokenRef.current) {
      console.log('🔄 Sync token changed, initializing...');
      
      previousTokenRef.current = syncToken;
      initializeSyncToken(syncToken);
      isInitializedRef.current = true;
      
      // 🔧 FIX: Always reset startup sync when token changes
      console.log('🔄 Resetting startup sync for token change');
      startupSyncDoneRef.current = false;
    }
  }, [syncToken, initializeSyncToken]);

  // 2. Initial sync only once per session, with better guards
  useEffect(() => {
    if (!syncToken || 
        !isInitializedRef.current || 
        startupSyncDoneRef.current ||
        isInitializingRef.current) {
      return;
    }
      
    console.log('⏱️ Scheduling startup sync in 3 seconds...');
    const timer = setTimeout(() => {
      // 🔧 IMPROVED: Double-check conditions before starting
      if (isInitializingRef.current || startupSyncDoneRef.current) {
        console.log('⏸️ Startup sync cancelled - state changed');
        return;
      }
      
      console.log('🚀 Performing startup sync');
      
      performSyncWithDebouncing('startup', 'timer', true).finally(() => {
        startupSyncDoneRef.current = true;
      });
    }, 3000);

    return () => {
      console.log('🛑 Startup sync cancelled (cleanup)');
      clearTimeout(timer);
    };
  }, [syncToken, performSyncWithDebouncing]);

  // 3. React Native: AppState change handler with debouncing
  useEffect(() => {
    let appStateTimer: NodeJS.Timeout | null = null;
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && 
          syncToken && 
          isInitializedRef.current && 
          !isInitializingRef.current) {
        
        if (appStateTimer) {
          clearTimeout(appStateTimer);
        }
        
        appStateTimer = setTimeout(() => {
          performRecoverySync('appstate'); // 🔧 Use debounced recovery function
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
  }, [syncToken, performRecoverySync]);

  // 4. React Native: NetInfo for network status with debouncing
  useEffect(() => {
    let networkTimer: NodeJS.Timeout | null = null;
    
    const handleNetworkChange = (state: any) => {
      if (state.isConnected && 
          syncToken && 
          isInitializedRef.current && 
          !isInitializingRef.current) {
        
        if (networkTimer) {
          clearTimeout(networkTimer);
        }
        
        networkTimer = setTimeout(() => {
          performRecoverySync('network'); // 🔧 Use debounced recovery function
        }, 1000);
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    
    return () => {
      unsubscribe();
      if (networkTimer) {
        clearTimeout(networkTimer);
      }
    };
  }, [syncToken, performRecoverySync]);

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
    performSyncWithDebouncing('manual', 'user', true);
  }, [syncToken, performSyncWithDebouncing]);

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