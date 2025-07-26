import { useEffect, useCallback, useRef } from 'react';
import { 
  getCriticalBootstrap, 
  getSecondaryBootstrap,
} from '@/services/bootstrapService';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useBootstrapDistributor } from './useBootstrapDistributor';

export const useBootstrap = () => {
  const hasInitialized = useRef(false);
  const { distributeCriticalData, distributeSecondaryData } = useBootstrapDistributor();

  // Bootstrap state fra BootstrapStore
  const {
    user,
    friends,
    blockedUsers,
    settings,
    pendingFriendInvitations,
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
  } = useBootstrapStore();

  // Conversations data fra ChatStore
  const { conversations } = useChatStore();

  // MessageNotifications data fra MessageNotificationStore
  const { notifications: messageNotifications } = useMessageNotificationStore();

  // Cleanup old cache ved oppstart
  useEffect(() => {
    cleanupOldCache();
  }, [cleanupOldCache]);

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

  // 🔧 LITT FORBEDRET: Main bootstrap function
  const bootstrap = useCallback(async () => {
    console.log("🔄 Starter full bootstrap...");
    
    // Critical data først (blokkerende for app-funksjonalitet)
    const criticalSuccess = await loadCriticalData();
    
    if (criticalSuccess) {
      // Secondary data i bakgrunnen (non-blocking)
      loadSecondaryData().catch(error => {
        console.warn("⚠️ Secondary bootstrap failed (non-critical):", error);
        // Ikke kast error - appen kan fortsatt fungere uten secondary data
      });
    } else {
      console.error("💥 Critical bootstrap failed - appen kan ikke starte riktig");
    }
  }, [loadCriticalData, loadSecondaryData]);

  // Retry functions
  const retryCritical = useCallback(() => {
    console.log("🔄 Retrying critical bootstrap...");
    loadCriticalData();
  }, [loadCriticalData]);

  const retrySecondary = useCallback(() => {
    console.log("🔄 Retrying secondary bootstrap...");
    loadSecondaryData();
  }, [loadSecondaryData]);

  // 🔧 FORBEDRET: Auto-bootstrap med bedre logikk
  useEffect(() => {
    // Strict mode protection
    if (hasInitialized.current) {
      console.log("✅ useBootstrap already initialized, skipping...");
      return;
    }
    hasInitialized.current = true;
    
    const criticalValid = isCriticalCacheValid();
    const secondaryValid = isSecondaryCacheValid();
    
    console.log("🔍 Bootstrap cache status:", { criticalValid, secondaryValid });
    
    // 🎯 ENKLERE: Kun bootstrap hvis critical cache er invalid
    // (secondary kjøres automatisk hvis invalid)
    if (!criticalValid || !isBootstrapped) {
      console.log("🔄 Starting bootstrap (critical cache invalid or not bootstrapped)...");
      bootstrap();
    } else {
      console.log("✅ Bootstrap cache valid and app is bootstrapped");
      
      // 🔧 BONUS: Kjør kun secondary hvis den trenger oppdatering
      if (!secondaryValid) {
        console.log("🔄 Refreshing secondary data in background...");
        loadSecondaryData();
      }
    }
  }, [isCriticalCacheValid, isSecondaryCacheValid, isBootstrapped, bootstrap, loadSecondaryData]);

  return {
    // ✅ Data fra alle stores
    user,                      // fra BootstrapStore
    friends,                   // fra BootstrapStore
    blockedUsers,             // fra BootstrapStore  
    settings,                 // fra BootstrapStore
    syncToken,                // fra BootstrapStore
    pendingFriendInvitations,
    conversations,            // fra ChatStore
    messageNotifications,     // fra MessageNotificationStore
    
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