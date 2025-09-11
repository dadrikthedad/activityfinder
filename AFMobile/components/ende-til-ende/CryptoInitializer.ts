// CryptoInitializer.tsx - Dedikert E2EE initialisering
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { CryptoServiceBackup } from './CryptoServiceBackup';

interface CryptoInitializerProps {
  // Start E2EE når bruker er autentisert, IKKE når bootstrap er ferdig
  shouldInitialize: boolean;
  onInitialized?: (success: boolean) => void;
}

export function CryptoInitializer({ shouldInitialize, onInitialized }: CryptoInitializerProps) {
  const { userId } = useAuth();
  const initializationAttemptRef = useRef<number | null>(null);
  const isInitializingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasCalledCallbackRef = useRef(false); // Track if callback was called
  
  const { 
    e2eeInitialized, 
    e2eeHasKeyPair, 
    e2eeError,
    setE2EEState 
  } = useBootstrapStore();

  // Main E2EE initialization effect
  useEffect(() => {
    const initializeCrypto = async () => {
      // Guards
      if (!userId || !shouldInitialize || isInitializingRef.current) {
        return;
      }

      // Skip if already successfully initialized AND callback was called
      if (e2eeInitialized && e2eeHasKeyPair && !e2eeError && hasCalledCallbackRef.current) {
        return;
      }

      // Skip if this is the same user attempt
      if (initializationAttemptRef.current === userId) {
        console.log("🔐 CRYPTO: Already attempted for this user, skipping");
        return;
      }

      console.log(`🔐 CRYPTO: Starting E2EE initialization for user ${userId}`);
      isInitializingRef.current = true;
      initializationAttemptRef.current = userId;

      try {
        const backupService = CryptoServiceBackup.getInstance();
        const result = await backupService.initializeForUser(userId);
        
        // Set E2EE state based on result
        if (result.needsSetup) {
          setE2EEState(true, false, 'needs_setup');
          console.log("✅ CRYPTO: E2EE initialized - needs setup");
        } else if (result.needsRestore) {
          setE2EEState(true, false, 'needs_restore');
          console.log("✅ CRYPTO: E2EE initialized - needs restore");
        } else {
          setE2EEState(true, true, null);
          console.log("✅ CRYPTO: E2EE initialized - ready");
        }
        
        console.log("✅ CRYPTO: E2EE initialization completed successfully");
        hasCalledCallbackRef.current = true; // Mark callback as called
        onInitialized?.(true);
      } catch (error) {
        console.error("❌ CRYPTO: E2EE initialization failed:", error);
        
        // Handle error by setting appropriate E2EE state
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = errorMessage.includes('timeout') || 
                              errorMessage.includes('network') || 
                              errorMessage.includes('fetch');
        
        if (isNetworkError) {
          setE2EEState(true, false, 'network_error');
        } else {
          setE2EEState(true, false, errorMessage);
        }
        
        hasCalledCallbackRef.current = true; // Mark callback as called even on error
        onInitialized?.(false);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeCrypto();
  }, [userId, shouldInitialize, e2eeInitialized, e2eeHasKeyPair, e2eeError, onInitialized, setE2EEState]);

  // Network error recovery
  useEffect(() => {
    if (e2eeError === 'network_error' && shouldInitialize) {
      console.log("🔐 CRYPTO: Scheduling network error recovery in 30s");
      
      retryTimeoutRef.current = setTimeout(async () => {
        try {
          console.log("🔄 CRYPTO: Attempting network error recovery");
          isInitializingRef.current = false; // Reset guard
          initializationAttemptRef.current = null; // Allow retry
          hasCalledCallbackRef.current = false; // Allow callback again
          
          const backupService = CryptoServiceBackup.getInstance();
          const result = await backupService.initializeForUser(userId!);
          
          // Update state based on result
          if (result.needsSetup) {
            setE2EEState(true, false, 'needs_setup');
          } else if (result.needsRestore) {
            setE2EEState(true, false, 'needs_restore');
          } else {
            setE2EEState(true, true, null);
          }
        } catch (error) {
          console.error("❌ CRYPTO: Network recovery failed:", error);
        }
      }, 30000);

      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }
  }, [e2eeError, shouldInitialize, userId, setE2EEState]);

  // Reset state on user change
  useEffect(() => {
    return () => {
      // Cleanup on user switch
      isInitializingRef.current = false;
      initializationAttemptRef.current = null;
      hasCalledCallbackRef.current = false; // Reset callback flag
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [userId]);

  // Debug logging
  useEffect(() => {
    if (e2eeInitialized) {
      const status = e2eeHasKeyPair ? 'ready' : (e2eeError || 'pending');
      console.log(`🔐 CRYPTO: Status update - ${status}`);
    }
  }, [e2eeInitialized, e2eeHasKeyPair, e2eeError]);

  return null;
}