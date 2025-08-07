// AppInitializer.native.tsx - React Native versjon
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

export function AppInitializer() {
  const { userId, token } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedOnlineRef = useRef(false);
  const initializationStrategyRef = useRef<'none' | 'bootstrap' | 'sync'>('none');
  
  const { markCacheAsLoaded } = useBootstrapDistributor();
  
  const { 
    isBootstrapped, 
    criticalLoading, 
    criticalError,
    bootstrap,
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
    console.log("🔍 BOOT: AppInitializer effect triggered:", { 
      token: token?.substring(0, 20), 
      userId,
      tokenExists: !!token,
      userIdExists: !!userId
    });
    
    if (!token || !userId) {
      console.log("⏸️ BOOT: No token or userId, skipping initialization");
      hasInitializedOnlineRef.current = false;
      initializationStrategyRef.current = 'none';

      if (isOnline) {
        console.log("📡 BOOT: Not authenticated - marking offline");
        markOffline();
      }
      return;
    }
    
    // Ny bruker i samme sesjon? Reset alle stores
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      console.log("🔄 BOOT: User switch detected, resetting all stores...");
      useBootstrapStore.getState().reset();
      useChatStore.getState().reset();
      useMessageNotificationStore.getState().reset();
      useNotificationStore.getState().reset();
      useUserCacheStore.getState().reset();

      // Reset states
      retryCountRef.current = 0;
      hasInitializedOnlineRef.current = false;
      initializationStrategyRef.current = 'none';

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
    
    console.log("🚀 BOOT: AppInitializer ready for userId =", userId);
  }, [token, userId, isOnline, markOffline]);

  // 🔑 SMART INITIALIZATION LOGIC
  useEffect(() => {
    const initializeApp = async () => {
      if (!token || !userId || criticalLoading) {
        return;
      }

      // Hvis vi allerede har bestemt strategi, ikke gjør noe mer
      if (initializationStrategyRef.current !== 'none') {
        return;
      }

      const criticalValid = isCriticalCacheValid();
      const secondaryValid = isSecondaryCacheValid();
      
      // React Native: Bruk AsyncStorage istedenfor localStorage
      const hasCachedSyncToken = await AsyncStorage.getItem('lastSyncToken');
      
      console.log("🧠 BOOT: Determining initialization strategy:", {
        criticalValid,
        secondaryValid,
        hasCachedSyncToken: !!hasCachedSyncToken,
        isBootstrapped
      });

      // 🎯 BESLUTNINGSLOGIKK:
      
      // 1. Hvis vi har gyldig cache OG sync token → Bruk SYNC
      if (criticalValid && secondaryValid && hasCachedSyncToken && !isBootstrapped) {
        console.log("✨ BOOT: Valid cache + sync token found → Using SYNC strategy");
        initializationStrategyRef.current = 'sync';
        
        // Merk cache som loaded siden vi har gyldig data
        markCacheAsLoaded();
        
        // Start sync umiddelbart for å få latest changes
        console.log("🚀 SYNC: Starting immediate sync with cached token");
        triggerSync();
        return;
      }
      
      // 2. Hvis vi mangler cache eller token → Bruk BOOTSTRAP
      if (!criticalValid || !secondaryValid || !hasCachedSyncToken || !isBootstrapped) {
        console.log("🔄 BOOT: Missing cache or token → Using BOOTSTRAP strategy");
        initializationStrategyRef.current = 'bootstrap';
        
        console.log("🚀 BOOT: Triggering full bootstrap...");
        bootstrap();
        return;
      }
      
      // 3. Allerede bootstrapped og har alt vi trenger
      console.log("✅ BOOT: Already initialized, nothing to do");
    };

    initializeApp();
  }, [
    token, 
    userId, 
    criticalLoading, 
    isCriticalCacheValid, 
    isSecondaryCacheValid, 
    isBootstrapped,
    bootstrap, 
    markCacheAsLoaded, 
    triggerSync
  ]);

  // Online status orchestration
  useEffect(() => {
    const shouldGoOnline = (
      token &&                
      userId &&               
      (isBootstrapped || initializationStrategyRef.current === 'sync') && // 🔧 Tillat online med sync strategy
      user &&                 
      !criticalError &&       
      !isConnecting          
    );

    if (shouldGoOnline && !isOnline) {
      console.log("✅ BOOT: Conditions met for going online - marking user online");
      markOnline();
    }
    
    if (shouldGoOnline && !hasInitializedOnlineRef.current) {
      hasInitializedOnlineRef.current = true;
      console.log("🎯 BOOT: Initial online setup complete");
    }
  }, [
    token,
    userId,
    isBootstrapped, 
    user, 
    criticalError,
    isOnline, 
    isConnecting,
    markOnline
  ]);

  // React Native: AppState handler (erstatter document.visibilitychange)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (!token || !userId || (!isBootstrapped && initializationStrategyRef.current !== 'sync') || !user) {
        return;
      }

      if (nextAppState === 'active' && !isOnline && !isConnecting) {
        console.log("👁️ BOOT: App became active and we're offline - attempting to go online");
        markOnline();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [token, userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  // 🆕 SYNC EVENT LISTENERS - tilpasset for React Native
  useEffect(() => {
    const handleFullRefreshRequired = (event: any) => {
      console.log("🔄 SYNC: Full refresh required:", event?.detail?.reason || 'Unknown reason');
      
      // Reset strategy og trigger bootstrap
      initializationStrategyRef.current = 'bootstrap';
      bootstrap();
    };

    const handleSyncError = (event: any) => {
      console.error("❌ SYNC: Sync error:", event?.detail || 'Unknown error');
      
      // Hvis sync feiler og vi ikke har bootstrap som fallback
      if (initializationStrategyRef.current === 'sync' && !isBootstrapped) {
        console.log("🔄 SYNC: Sync failed, falling back to bootstrap");
        initializationStrategyRef.current = 'bootstrap';
        bootstrap();
      }
    };

    // React Native: Bruk custom event system eller direkte callback
    // Siden RN ikke har window.addEventListener for custom events,
    // kan du enten bruke DeviceEventEmitter eller implementere egen event system
    
    // For nå, kommenterer ut event listeners - implementer disse hvis du har sync
    // DeviceEventEmitter.addListener('sync:fullRefreshRequired', handleFullRefreshRequired);
    // DeviceEventEmitter.addListener('sync:error', handleSyncError);

    return () => {
      // DeviceEventEmitter.removeListener('sync:fullRefreshRequired', handleFullRefreshRequired);
      // DeviceEventEmitter.removeListener('sync:error', handleSyncError);
    };
  }, [bootstrap, isBootstrapped]);

  // Exponential backoff retry logic (kun for bootstrap errors)
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

  // 🆕 STRATEGY STATUS DEBUG
  useEffect(() => {
    const strategy = initializationStrategyRef.current;
    
    if (strategy !== 'none') {
      console.log("🎯 INIT: Strategy status:", {
        strategy,
        isBootstrapped: strategy === 'bootstrap' ? isBootstrapped : 'N/A',
        isSyncInitialized: strategy === 'sync' ? isSyncInitialized : 'N/A',
        signalRConnected: isSignalRConnected,
        fallbackActive: isFallbackActive,
        lastSyncAt: lastSyncAt?.toISOString(),
        hasSyncToken
      });
    }
  }, [isBootstrapped, isSyncInitialized, isSignalRConnected, isFallbackActive, lastSyncAt, hasSyncToken]);

  return null;
}