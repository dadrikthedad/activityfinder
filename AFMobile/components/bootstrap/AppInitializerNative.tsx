// AppInitializer.native.tsx - Med guard mot loops
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
import { useUserCacheStore, useFriends, useBlockedUsers } from '@/store/useUserCacheStore';
import { useBootstrapDistributor } from "@/hooks/bootstrap/useBootstrapDistributor";
import { useSyncNative } from "@/hooks/sync/useSyncNative";
import { handleUserSwitch } from '@/utils/signalr/chatHub';
import authServiceNative from "@/services/user/authServiceNative";

export function AppInitializer() {
  const { userId } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedOnlineRef = useRef(false);
  const initializationStrategyRef = useRef<'none' | 'bootstrap' | 'sync'>('none');
  
  // 🔧 NEW: Guard mot concurrent initialization
  const isInitializingRef = useRef(false);
  
  const { markCacheAsLoaded } = useBootstrapDistributor();
  
  // Global E2EE state från BootstrapStore (kun for å sjekke status)
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
    isSignalRConnected, 
    isFallbackActive, 
    lastSyncAt, 
    triggerSync,
    isInitialized: isSyncInitialized,
    hasToken: hasSyncToken
  } = useSyncNative();

  // Reset stores ved brukerbytte
  useEffect(() => { 
    const checkAuth = async () => {
      const isAuthenticated = await authServiceNative.isAuthenticated();
      
      if (!isAuthenticated || !userId) {
        console.log("⏸️ BOOT: Not authenticated, skipping initialization");
        hasInitializedOnlineRef.current = false;
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false; // Reset guard

        // Reset E2EE state når ikke autentisert
        setE2EEState(false, false, null);

        if (isOnline) {
          console.log("📡 BOOT: Not authenticated - marking offline");
          markOffline();
        }
        return;
      }
      
      // Ny bruger i samme sesjon? Reset alla stores
      if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
        console.log("🔄 BOOT: User switch detected, resetting all stores...");
        
        handleUserSwitch().catch(err => 
          console.error('Failed to handle SignalR user switch:', err)
        );

        useBootstrapStore.getState().reset(); // Detta resettar även E2EE state
        useChatStore.getState().reset();
        useMessageNotificationStore.getState().reset();
        useNotificationStore.getState().reset();
        useUserCacheStore.getState().reset();

        // Reset states
        retryCountRef.current = 0;
        hasInitializedOnlineRef.current = false;
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false; // Reset guard

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

  // 🔑 SMART INITIALIZATION LOGIC med loop protection
  useEffect(() => {
    const initializeApp = async () => {
      if (!userId || criticalLoading) {
        return;
      }

      // 🔧 GUARD: Hindre concurrent initialization
      if (isInitializingRef.current) {
        console.log("🛑 BOOT: Already initializing, skipping");
        return;
      }

      console.log("🔐 BOOT: Checking E2EE status (global):", { 
        e2eeInitialized, 
        e2eeHasKeyPair, 
        e2eeError 
      });

      // Om vi allerede har bestämt strategi, gör inget mer
      if (initializationStrategyRef.current !== 'none') {
        console.log(`🛑 BOOT: Strategy already set to ${initializationStrategyRef.current}, skipping`);
        return;
      }

      // Set guard
      isInitializingRef.current = true;

      try {
        const criticalValid = isCriticalCacheValid();
        const secondaryValid = isSecondaryCacheValid();
        
        const hasCachedSyncToken = await AsyncStorage.getItem('lastSyncToken');
        
        console.log("🧠 BOOT: Determining initialization strategy:", {
          criticalValid,
          secondaryValid,
          hasCachedSyncToken: !!hasCachedSyncToken,
          isBootstrapped,
          e2eeInitialized,
          e2eeHasKeyPair
        });

        // 1. Om vi har giltig cache OCH sync token → Använd SYNC
        if (criticalValid && secondaryValid && hasCachedSyncToken && !isBootstrapped) {
          console.log("✨ BOOT: Valid cache + sync token found → Using SYNC strategy");
          initializationStrategyRef.current = 'sync';
          
          markCacheAsLoaded();
          triggerSync();
          return;
        }
        
        // 2. Om vi saknar cache eller token → Använd BOOTSTRAP (inkluderer E2EE)
        if (!criticalValid || !secondaryValid || !hasCachedSyncToken || !isBootstrapped) {
          console.log("🔄 BOOT: Missing cache or token → Using BOOTSTRAP strategy (will handle E2EE)");
          initializationStrategyRef.current = 'bootstrap';
          
          console.log("🚀 BOOT: Triggering full bootstrap (E2EE will be initialized in bootstrap)...");
          const criticalSuccess = await bootstrap();

          if (criticalSuccess) {
            console.log("🚀 BOOT: Triggering secondary bootstrap...");
            loadSecondaryData();
          }
          return;
        }
        
        console.log("✅ BOOT: Already initialized, nothing to do");
      } catch (error) {
        console.error("❌ BOOT: Initialization error:", error);
      } finally {
        // Clear guard
        isInitializingRef.current = false;
      }
    };

    initializeApp();
  }, [
    userId,
    criticalLoading, 
    isBootstrapped,
  ]);

  // Online status orchestration - nå med global E2EE state
  useEffect(() => {
    const shouldGoOnline = (
      userId &&
      (isBootstrapped || initializationStrategyRef.current === 'sync') &&
      user &&
      !criticalError &&
      !isConnecting
    );

    if (shouldGoOnline && !isOnline) {
      console.log("✅ BOOT: Conditions met for going online (including E2EE from bootstrap) - marking user online");
      markOnline();
    }
    
    if (shouldGoOnline && !hasInitializedOnlineRef.current) {
      hasInitializedOnlineRef.current = true;
      console.log("🎯 BOOT: Initial online setup complete (with E2EE from bootstrap)");
    }
  }, [
    userId,
    isBootstrapped, 
    user, 
    criticalError,
    isOnline, 
    isConnecting,
    markOnline,
  ]);

  // React Native: AppState handler
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
      
      // Reset guards for new initialization
      isInitializingRef.current = false;
      initializationStrategyRef.current = 'bootstrap';
      bootstrap();
    };

    const handleSyncError = (event: any) => {
      console.error("❌ SYNC: Sync error:", event?.detail || 'Unknown error');
      
      if (initializationStrategyRef.current === 'sync' && !isBootstrapped) {
        console.log("🔄 SYNC: Sync failed, falling back to bootstrap");
        // Reset guards for new initialization
        isInitializingRef.current = false;
        initializationStrategyRef.current = 'bootstrap';
        bootstrap();
      }
    };

    return () => {
    };
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
          // Reset guard for retry
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

  // Debug logging - med E2EE state från bootstrap
  useEffect(() => {
    const strategy = initializationStrategyRef.current;
    
    if (strategy === 'bootstrap' && criticalLoading) {
      console.log("⏳ BOOT: Loading critical bootstrap data (including E2EE)...");
    } else if (strategy === 'sync' && isSyncInitialized) {
      console.log("✅ SYNC: Sync-based initialization complete!");
    } else if (isBootstrapped && !criticalError) {
      console.log("✅ BOOT: Bootstrap complete!", {
        strategy,
        e2eeInitialized,
        e2eeHasKeyPair,
        retryCount: retryCountRef.current > 0 ? retryCountRef.current : "no retries needed"
      });
    }
  }, [criticalLoading, isBootstrapped, criticalError, isSyncInitialized, e2eeInitialized, e2eeHasKeyPair]);

  return null;
}