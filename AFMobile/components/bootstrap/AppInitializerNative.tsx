// AppInitializer.native.tsx - Oppdatert med CryptoInitializer og riktig sequence
import { useEffect, useRef } from "react";
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap";
import { useOnlineStatus } from "@/hooks/bootstrap/useOnlineStatus";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useBootstrapDistributor } from "@/hooks/bootstrap/useBootstrapDistributor";
import { useSyncNative } from "@/hooks/sync/useSyncNative";
import { handleUserSwitch } from '@/utils/signalr/chatHub';
import authServiceNative from "@/services/user/authServiceNative";
import { CryptoInitializer } from "../ende-til-ende/CryptoInitializer";

export function AppInitializer() {
  const { userId } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedOnlineRef = useRef(false);
  const initializationStrategyRef = useRef<'none' | 'bootstrap' | 'sync'>('none');
  const isInitializingRef = useRef(false);
  
  const { markCacheAsLoaded } = useBootstrapDistributor();
  
  // E2EE state for status checking
  const { 
    e2eeInitialized, 
    e2eeHasKeyPair, 
    e2eeError, 
    setE2EEState 
  } = useBootstrapStore();
  
  const { 
    isBootstrapped, 
    criticalLoading, 
    criticalError,
    bootstrap,
    loadSecondaryData,
    retryCritical,
    isCriticalCacheValid,
    isSecondaryCacheValid,
    user
  } = useBootstrap();

  const { 
    isOnline, 
    isConnecting, 
    markOnline,
    markOffline 
  } = useOnlineStatus();

  const { 
    triggerSync,
    isInitialized: isSyncInitialized,
  } = useSyncNative();

  // Reset stores ved brukerbytte
  useEffect(() => { 
    const checkAuth = async () => {
      const isAuthenticated = await authServiceNative.isAuthenticated();
      
      if (!isAuthenticated || !userId) {
        console.log("⏸️ BOOT: Not authenticated, skipping initialization");
        hasInitializedOnlineRef.current = false;
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false;

        setE2EEState(false, false, null);

        if (isOnline) {
          console.log("📡 BOOT: Not authenticated - marking offline");
          markOffline();
        }
        return;
      }
      
      // User switch detection
      if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
        console.log("🔄 BOOT: User switch detected, resetting all stores...");
        
        handleUserSwitch().catch(err => 
          console.error('Failed to handle SignalR user switch:', err)
        );

        useBootstrapStore.getState().reset();
        useChatStore.getState().reset();
        useMessageNotificationStore.getState().reset();
        useNotificationStore.getState().reset();
        useUserCacheStore.getState().reset();

        // Reset states
        retryCountRef.current = 0;
        hasInitializedOnlineRef.current = false;
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false;

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = undefined;
        }

        if (isOnline) {
          console.log("📡 BOOT: User switch - marking offline");
          markOffline();
        }
      }
      prevUserIdRef.current = userId;
    };
    
    checkAuth();
  }, [userId, isOnline, markOffline, setE2EEState]);

  // Reset guards ved brukerbytte
  useEffect(() => {
    if (userId !== prevUserIdRef.current) {
      isInitializingRef.current = false;
      initializationStrategyRef.current = 'none';
    }
  }, [userId]);

  // BOOTSTRAP/SYNC INITIALIZATION (venter på E2EE)
  useEffect(() => {
    const initializeApp = async () => {
      if (!userId || criticalLoading || isInitializingRef.current) {
        return;
      }

      // VIKTIG: Vent på E2EE før bootstrap starter
      if (!e2eeInitialized) {
        console.log("🛑 BOOT: Waiting for E2EE initialization before bootstrap");
        return;
      }

      if (initializationStrategyRef.current !== 'none') {
        console.log(`🛑 BOOT: Strategy already set to ${initializationStrategyRef.current}, skipping`);
        return;
      }

      console.log("🧠 BOOT: E2EE ready, determining bootstrap strategy");
      isInitializingRef.current = true;

      try {
        const criticalValid = isCriticalCacheValid();
        const secondaryValid = isSecondaryCacheValid();
        const hasCachedSyncToken = await AsyncStorage.getItem('lastSyncToken');
        
        console.log("🧠 BOOT: Strategy decision:", {
          criticalValid,
          secondaryValid,
          hasCachedSyncToken: !!hasCachedSyncToken,
          isBootstrapped,
          e2eeReady: e2eeInitialized && e2eeHasKeyPair
        });

        // SYNC strategy
        if (criticalValid && secondaryValid && hasCachedSyncToken && !isBootstrapped) {
          console.log("✨ BOOT: Using SYNC strategy (E2EE ready)");
          initializationStrategyRef.current = 'sync';
          markCacheAsLoaded();
          triggerSync();
          return;
        }
        
        // BOOTSTRAP strategy
        if (!criticalValid || !secondaryValid || !hasCachedSyncToken || !isBootstrapped) {
          console.log("🔄 BOOT: Using BOOTSTRAP strategy (E2EE ready)");
          initializationStrategyRef.current = 'bootstrap';
          
          const criticalSuccess = await bootstrap();
          if (criticalSuccess) {
            console.log("🚀 BOOT: Triggering secondary bootstrap...");
            loadSecondaryData();
          }
          return;
        }
        
        console.log("✅ BOOT: Already initialized");
      } catch (error) {
        console.error("❌ BOOT: Initialization error:", error);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeApp();
  }, [userId, criticalLoading, isBootstrapped, e2eeInitialized]);

  // Online status orchestration
  useEffect(() => {
    const shouldGoOnline = (
      userId &&
      (isBootstrapped || initializationStrategyRef.current === 'sync') &&
      user &&
      !criticalError &&
      !isConnecting &&
      // E2EE check: either ready or in offline mode
      (e2eeInitialized && (e2eeHasKeyPair || e2eeError === 'network_error'))
    );

    if (shouldGoOnline && !isOnline) {
      if (e2eeError === 'network_error') {
        console.log("🔶 BOOT: Going online with E2EE in offline mode");
      } else {
        console.log("✅ BOOT: Going online");
      }
      markOnline();
    }
    
    if (shouldGoOnline && !hasInitializedOnlineRef.current) {
      hasInitializedOnlineRef.current = true;
      console.log("🎯 BOOT: Initial online setup complete");
    }
  }, [
    userId, isBootstrapped, user, criticalError, isOnline, isConnecting,
    markOnline, e2eeInitialized, e2eeHasKeyPair, e2eeError
  ]);

  // AppState handler
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (!userId || (!isBootstrapped && initializationStrategyRef.current !== 'sync') || !user) {
        return;
      }

      if (nextAppState === 'active' && !isOnline && !isConnecting) {
        console.log("👁️ BOOT: App became active and we're offline - attempting to go online");
        markOnline();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  // SYNC EVENT LISTENERS
  useEffect(() => {
    const handleFullRefreshRequired = (event: any) => {
      console.log("🔄 SYNC: Full refresh required:", event?.detail?.reason || 'Unknown reason');
      isInitializingRef.current = false;
      initializationStrategyRef.current = 'bootstrap';
      bootstrap();
    };

    const handleSyncError = (event: any) => {
      console.error("❌ SYNC: Sync error:", event?.detail || 'Unknown error');
      
      if (initializationStrategyRef.current === 'sync' && !isBootstrapped) {
        console.log("🔄 SYNC: Sync failed, falling back to bootstrap");
        isInitializingRef.current = false;
        initializationStrategyRef.current = 'bootstrap';
        bootstrap();
      }
    };

    return () => {};
  }, [bootstrap, isBootstrapped]);

  // Exponential backoff retry logic
  useEffect(() => {
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000];

    if (criticalError && initializationStrategyRef.current === 'bootstrap') {
      if (retryCountRef.current < maxRetries) {
        const delay = retryDelays[retryCountRef.current] || 16000;
        
        console.log(
          `❌ BOOT: Bootstrap error: ${criticalError}. ` +
          `Retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`
        );
        
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 BOOT: Executing retry ${retryCountRef.current + 1}`);
          retryCountRef.current++;
          isInitializingRef.current = false;
          retryCritical();
        }, delay);
      } else {
        console.log("🛑 BOOT: Max retries reached. Manual intervention required.");
      }
    } else if (isBootstrapped) {
      if (retryCountRef.current > 0) {
        console.log("✅ BOOT: Bootstrap successful, resetting retry counter");
        retryCountRef.current = 0;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [criticalError, isBootstrapped, retryCritical]);

  // E2EE initialization callback
  const handleCryptoInitialized = (success: boolean) => {
    if (success) {
      console.log("🔐 BOOT: E2EE ready");
    } else {
      console.log("🔐 BOOT: E2EE failed, continuing in limited mode");
    }
  };

  // Debug logging
  useEffect(() => {
    const strategy = initializationStrategyRef.current;
    
    if (strategy === 'bootstrap' && criticalLoading) {
      console.log("⏳ BOOT: Loading critical bootstrap data...");
    } else if (strategy === 'sync' && isSyncInitialized) {
      console.log("✅ SYNC: Sync-based initialization complete!");
    } else if (isBootstrapped && !criticalError) {
      console.log("✅ BOOT: Bootstrap complete!", {
        strategy,
        retryCount: retryCountRef.current > 0 ? retryCountRef.current : "no retries needed"
      });
    }
  }, [criticalLoading, isBootstrapped, criticalError, isSyncInitialized]);

  return (
    <>
      {/* E2EE initialisering - MÅ være ferdig før bootstrap */}
      <CryptoInitializer 
        shouldInitialize={!!userId}
        onInitialized={handleCryptoInitialized}
      />
    </>
  );
}