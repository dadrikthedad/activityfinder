import { useEffect, useCallback, useRef } from 'react';
import { 
  getCriticalBootstrap, 
  getSecondaryBootstrap,
} from '@/services/bootstrap/bootstrapService';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useBootstrapDistributor } from './useBootstrapDistributor';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUserCacheStore } from '@/store/useUserCacheStore'; 
import { useOnlineStatus } from './useOnlineStatus';

export const useBootstrap = () => {
  const hasInitialized = useRef(false);
  const { distributeCriticalData, distributeSecondaryData, markCacheAsLoaded } = useBootstrapDistributor();
  const { markOnline } = useOnlineStatus();

  // Bootstrap state fra BootstrapStore
  const {
    syncToken,
    criticalLoading,
    secondaryLoading,
    isBootstrapped,
    criticalError,
    secondaryError,
    isCriticalCacheValid,
    isSecondaryCacheValid,
    setCriticalLoading,
    setCriticalError,
    setSecondaryLoading,
    setSecondaryError,
    cleanupOldCache,
    setBootstrapped,
  } = useBootstrapStore();

  // Conversations data fra ChatStore
  const { conversations } = useChatStore();

  // MessageNotifications data fra MessageNotificationStore
  const { messageNotifications: messageNotifications } = useMessageNotificationStore();

  // Friend requests fra NotificationStore
  const { friendRequests: pendingFriendInvitations } = useNotificationStore();

  const { notifications: appNotifications } = useNotificationStore();

  const {
    currentUser: user,
    settings,
    cleanupOldUsers
  } = useUserCacheStore();

  // Cleanup old cache ved oppstart
  useEffect(() => {
    cleanupOldCache();
    cleanupOldUsers();
  }, [cleanupOldCache, cleanupOldUsers]);

  // Load critical data med cache validation
  const loadCriticalData = useCallback(async () => {
    if (isCriticalCacheValid()) {
      console.log("✅ Critical cache er gyldig, hopper over API-kall");
      return true;
    }

    setCriticalLoading(true);
    setCriticalError(null);

    try {
      console.log("🚀 Starter kritisk bootstrap...");
      const criticalData = await getCriticalBootstrap();
      
      if (criticalData) {
        distributeCriticalData(criticalData);
        console.log("✅ Kritisk bootstrap ferdig via distributor");
        return true;
      } else {
        throw new Error("Ingen kritisk data mottatt");
      }
    } catch (error) {
      console.error("❌ Kritisk bootstrap feilet:", error);
      setCriticalError(error instanceof Error ? error.message : "Ukjent feil");
      return false;
    }
  }, [isCriticalCacheValid, distributeCriticalData, setCriticalLoading, setCriticalError]);

  // Load secondary data med cache validation
  const loadSecondaryData = useCallback(async () => {
    if (isSecondaryCacheValid()) {
      console.log("✅ Secondary cache er gyldig, hopper over API-kall");
      return true;
    }

    setSecondaryLoading(true);
    setSecondaryError(null);

    try {
      console.log("📚 Starter sekundær bootstrap...");
      const secondaryData = await getSecondaryBootstrap();
      
      if (secondaryData) {
        distributeSecondaryData(secondaryData);
        console.log("✅ Sekundær bootstrap ferdig via distributor");
        return true;
      } else {
        throw new Error("Ingen sekundær data mottatt");
      }
    } catch (error) {
      console.error("❌ Sekundær bootstrap feilet:", error);
      setSecondaryError(error instanceof Error ? error.message : "Ukjent feil");
      return false;
    }
  }, [isSecondaryCacheValid, distributeSecondaryData, setSecondaryLoading, setSecondaryError]);

  // Main bootstrap function
  const bootstrap = useCallback(async () => {
    console.log("🔄 Starter full bootstrap...");
    
    // Critical data først (blokkerende for app-funksjonalitet)
    const criticalSuccess = await loadCriticalData();
    
    if (criticalSuccess) {
      // 🔧 FIX: Start secondary data loading umiddelbart efter critical
      console.log("🔄 Critical bootstrap success, starting secondary bootstrap...");
      loadSecondaryData().catch(error => {
        console.warn("⚠️ Secondary bootstrap failed (non-critical):", error);
        // Ikke kast error - appen kan fortsatt fungere uten secondary data
      });
    } else {
      console.error("💥 Critical bootstrap failed - appen kan ikke starte riktig");
    }
  }, [loadCriticalData, loadSecondaryData]);

  // 🔧 FIX: Setter isBootstrapped når critical data er loaded
  useEffect(() => {
    const { hasLoadedCritical } = useBootstrapStore.getState();
    
    // Hvis vi har critical data men isBootstrapped er false, sett den til true
    if (hasLoadedCritical && user && !isBootstrapped && !criticalError) {
      console.log("✅ Found existing critical data, setting isBootstrapped = true");
      setBootstrapped(true);
    }
  }, [user, isBootstrapped, criticalError, setBootstrapped]);

  // 🔧 FIX: Separat useEffect for å trigge secondary bootstrap når vi blir bootstrapped
  useEffect(() => {
    if (isBootstrapped && !isSecondaryCacheValid() && !secondaryLoading && !secondaryError) {
      console.log("🔄 App is bootstrapped but secondary cache is invalid, loading secondary data...");
      loadSecondaryData().catch(error => {
        console.warn("⚠️ Secondary bootstrap failed after bootstrapped:", error);
      });
    }
  }, [isBootstrapped, isSecondaryCacheValid, secondaryLoading, secondaryError, loadSecondaryData]);

  // Retry functions
  const retryCritical = useCallback(() => {
    console.log("🔄 Retrying critical bootstrap...");
    loadCriticalData();
  }, [loadCriticalData]);

  const retrySecondary = useCallback(() => {
    console.log("🔄 Retrying secondary bootstrap...");
    loadSecondaryData();
  }, [loadSecondaryData]);

  // 🔧 FIX: Initial bootstrap logic
  useEffect(() => {
    if (hasInitialized.current) {
      console.log("✅ useBootstrap already initialized, skipping...");
      return;
    }
    hasInitialized.current = true;
    
    const criticalValid = isCriticalCacheValid();
    const secondaryValid = isSecondaryCacheValid();
    
    console.log("🔍 Bootstrap cache status:", { criticalValid, secondaryValid, isBootstrapped });
    
    if (!criticalValid || !isBootstrapped) {
      console.log("🔄 Starting bootstrap (critical cache invalid or not bootstrapped)...");
      bootstrap();
    } else {
      console.log("✅ Bootstrap cache valid and app is bootstrapped");
      
      markCacheAsLoaded();
      markOnline();
      
      // 🔧 FIX: Altid sjekk secondary data, selv når vi er bootstrapped
      if (!secondaryValid) {
        console.log("🔄 Refreshing secondary data in background...");
        loadSecondaryData().catch(error => {
          console.warn("⚠️ Background secondary bootstrap failed:", error);
        });
      }
    }
  }, [isCriticalCacheValid, isSecondaryCacheValid, isBootstrapped, bootstrap, markOnline, loadSecondaryData, markCacheAsLoaded]);

  return {
    // ✅ Data fra alle stores
    user,                      // fra UserCacheStore (currentUser)
    settings,                 // fra fra UserCacheStore
    pendingFriendInvitations, // fra NotificationStore
    syncToken,                // fra BootstrapStore
    conversations,            // fra ChatStore
    messageNotifications,     // fra MessageNotificationStore
    appNotifications,   
    
    // State
    isBootstrapped,
    criticalLoading,
    secondaryLoading,
    
    // Errors
    criticalError,
    secondaryError,
    hasErrors: !!(criticalError || secondaryError),
    
    // Actions
    bootstrap,
    retryCritical,
    retrySecondary,
    
    // Cache utilities
    isCriticalCacheValid,
    isSecondaryCacheValid,
    cleanupOldCache,
  };
};