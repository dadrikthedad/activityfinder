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
  const { isBootstrapped } = useBootstrapStore();

  const isInitializingRef = useRef(false);

  const lastRecoveryRef = useRef<number>(0);
  const RECOVERY_DEBOUNCE_MS = 5000;

  const lastSyncRef = useRef<number>(0);
  const GLOBAL_SYNC_DEBOUNCE_MS = 2000;

  const { performDeltaSync } = useDeltaSyncNative();

  const performRecoverySync = useCallback(async (source: 'appstate' | 'network' | 'signalr', force = false) => {
    if (isInitializingRef.current) {
      console.log(`⏸️ ${source} recovery sync skipped - already syncing`);
      return;
    }

    // SignalR reconnect er kritisk og skal ikke debounces
    if (!force && source !== 'signalr') {
      const now = Date.now();
      if (now - lastRecoveryRef.current < RECOVERY_DEBOUNCE_MS) {
        console.log(`⏸️ ${source} recovery sync debounced (${now - lastRecoveryRef.current}ms since last recovery)`);
        return;
      }
    }

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

  const performSyncWithDebouncing = useCallback(async (reason: SyncReason, source?: string, force = false) => {
    if (isInitializingRef.current) {
      console.log(`⏸️ ${reason} sync skipped - already syncing (source: ${source || 'unknown'})`);
      return;
    }

    if (!force && reason !== 'startup') {
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncRef.current;
      if (timeSinceLastSync < GLOBAL_SYNC_DEBOUNCE_MS) {
        console.log(`⏸️ ${reason} sync debounced - ${timeSinceLastSync}ms since last sync (source: ${source || 'unknown'})`);
        return;
      }
    }

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

  const { isFallbackActive, startFallback, stopFallback } = useFallbackSyncNative({
    performSync: (reason) => performSyncWithDebouncing(reason, 'fallback'),
  });

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
      performRecoverySync('signalr');
    }
  });

  // Startup sync er håndtert av AppInitializerNative.
  // useSyncNative håndterer kun løpende synkronisering (SignalR reconnect, appstate, nettverk).

  useEffect(() => {
    let appStateTimer: NodeJS.Timeout | null = null;
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isBootstrapped && !isInitializingRef.current) {
        if (appStateTimer) clearTimeout(appStateTimer);
        appStateTimer = setTimeout(() => performRecoverySync('appstate'), 500);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
      if (appStateTimer) clearTimeout(appStateTimer);
    };
  }, [isBootstrapped, performRecoverySync]);

  useEffect(() => {
    let networkTimer: NodeJS.Timeout | null = null;
    const handleNetworkChange = (state: any) => {
      if (state.isConnected && isBootstrapped && !isInitializingRef.current) {
        if (networkTimer) clearTimeout(networkTimer);
        networkTimer = setTimeout(() => performRecoverySync('network'), 1000);
      }
    };
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    return () => {
      unsubscribe();
      if (networkTimer) clearTimeout(networkTimer);
    };
  }, [isBootstrapped, performRecoverySync]);

  const triggerSync = useCallback(() => {
    if (!isBootstrapped) {
      console.warn('⚠️ Cannot trigger sync - not bootstrapped');
      return;
    }
    if (isInitializingRef.current) {
      console.warn('⚠️ Cannot trigger sync - already syncing');
      return;
    }
    performSyncWithDebouncing('manual', 'user', true);
  }, [isBootstrapped, performSyncWithDebouncing]);

  return {
    isSignalRConnected,
    isFallbackActive,
    lastSyncAt,
    triggerSync,
    isInitialized: isBootstrapped,
    isInitializing: isInitializingRef.current,
  };
}
