import { useEffect, useCallback, useState, useRef } from 'react';
import { 
  getCriticalBootstrap, 
  getSecondaryBootstrap,
} from '@/services/bootstrapService';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { ConversationDTO } from '@/types/ConversationDTO'; // 👈 LEGG TIL

export const useBootstrap = () => {
  const hasInitialized = useRef(false);
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);

  // Zustand store state
  const {
    // Data
    user,
    friends,
    blockedUsers,
    settings,
    syncToken,
    
    // Loading states
    criticalLoading,
    secondaryLoading,
    isBootstrapped,
    
    // Error states
    criticalError,
    secondaryError,
    
    // Cache validation
    isCriticalCacheValid,
    isSecondaryCacheValid,
    
    // Actions
    setCriticalData,
    setCriticalLoading,
    setCriticalError,
    setSecondaryData,
    setSecondaryLoading,
    setSecondaryError,
  } = useBootstrapStore();

  // Hent kritisk data først
  const loadCriticalData = useCallback(async () => {
    // Sjekk cache først
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
        setCriticalData(criticalData);
        setConversations(criticalData.recentConversations); // 👈 SETT I LOCAL STATE
        
        console.log("✅ Kritisk bootstrap ferdig:", {
          user: criticalData.user.fullName,
          conversations: criticalData.recentConversations?.length || 0,
        });
        
        return true;
      } else {
        throw new Error("Ingen kritisk data mottatt");
      }
    } catch (error) {
      console.error("❌ Kritisk bootstrap feilet:", error);
      setCriticalError(error instanceof Error ? error.message : "Ukjent feil");
      return false;
    }
  }, [isCriticalCacheValid, setCriticalData, setCriticalLoading, setCriticalError]);

  // Hent sekundær data i bakgrunnen
  const loadSecondaryData = useCallback(async () => {
    // Sjekk cache først
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
        setSecondaryData(secondaryData);
        
        console.log("✅ Sekundær bootstrap ferdig:", {
          friends: secondaryData.friends.length,
          blockedUsers: secondaryData.blockedUsers.length,
          language: secondaryData.settings.language,
        });
        
        return true;
      } else {
        throw new Error("Ingen sekundær data mottatt");
      }
    } catch (error) {
      console.error("❌ Sekundær bootstrap feilet:", error);
      setSecondaryError(error instanceof Error ? error.message : "Ukjent feil");
      return false;
    }
  }, [isSecondaryCacheValid, setSecondaryData, setSecondaryLoading, setSecondaryError]);

  // Hovedfunksjon som starter hele bootstrap-prosessen
  const bootstrap = useCallback(async () => {
    console.log("🔄 Starter full bootstrap...");
    
    // 1. Hent kritisk data først (blokkerer ikke UI)
    const criticalSuccess = await loadCriticalData();
    
    if (criticalSuccess) {
      // 2. Hent sekundær data i bakgrunnen (ikke-blokkerende)
      loadSecondaryData(); // Ikke await - kjør i bakgrunnen
    }
  }, [loadCriticalData, loadSecondaryData]);

  // Retry-funksjoner
  const retryCritical = useCallback(() => {
    loadCriticalData();
  }, [loadCriticalData]);

  const retrySecondary = useCallback(() => {
    loadSecondaryData();
  }, [loadSecondaryData]);

  // Auto-bootstrap ved mount (kan disable med parameter)
    useEffect(() => {
    // 👈 STRICT MODE PROTECTION
    if (hasInitialized.current) {
      console.log("✅ BOOT: useBootstrap already initialized, skipping...");
      return;
    }
    hasInitialized.current = true;
    
    const shouldBootstrap = !isCriticalCacheValid() || !isSecondaryCacheValid();
    
    if (shouldBootstrap) {
      console.log("🔄 BOOT: Cache expired or missing, starting bootstrap...");
      bootstrap();
    } else {
      console.log("✅ BOOT: Bootstrap cache valid, skipping bootstrap");
    }
  }, [isCriticalCacheValid, isSecondaryCacheValid, bootstrap]);

  return {
    // Data (direkte fra store)
    user,
    friends,
    blockedUsers,
    settings,
    syncToken,
    conversations, // 👈 CONVERSATIONS FRA STORE
    
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
  };
};