// CryptoInitializer.tsx - Dedikert E2EE initialisering med standalone modal

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { CryptoServiceBackup } from '@/components/ende-til-ende/CryptoServiceBackup';
import E2EERestoreModal from '@/features/crypto/components/E2EERestoreModal';

interface CryptoInitializerProps {
  shouldInitialize: boolean;
  onInitialized?: (success: boolean) => void;
}

export function CryptoInitializer({ shouldInitialize, onInitialized }: CryptoInitializerProps) {
  const { userId } = useAuth();
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const initializationAttemptRef = useRef<number | null>(null);
  const isInitializingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasCalledCallbackRef = useRef(false);
  const hasShownRestoreModalRef = useRef(false);
  
  const { 
    e2eeInitialized, 
    e2eeHasKeyPair, 
    e2eeError,
    setE2EEState 
  } = useBootstrapStore();

  // Handle successful restore
  const handleRestoreSuccess = useCallback(() => {
    console.log("✅ CRYPTO: E2EE restored successfully");
    setE2EEState(true, true, null);
    setShowRestoreModal(false);
    hasCalledCallbackRef.current = true;
    onInitialized?.(true);
  }, [setE2EEState, onInitialized]);

  // Handle skip restore
  const handleSkipRestore = useCallback(() => {
    console.log("⚠️ CRYPTO: User skipped E2EE restore");
    // Keep error state so user can restore later in settings
    setE2EEState(true, false, 'skipped_restore');
    setShowRestoreModal(false);
    hasCalledCallbackRef.current = true;
    onInitialized?.(true); // Still consider initialization "successful"
  }, [setE2EEState, onInitialized]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowRestoreModal(false);
  }, []);

  // Show restore modal when needed
  useEffect(() => {
    if (e2eeError === 'needs_restore' && !hasShownRestoreModalRef.current) {
      console.log("🔐 CRYPTO: Showing E2EE restore modal");
      hasShownRestoreModalRef.current = true;
      setShowRestoreModal(true);
    }
  }, [e2eeError]);

  // Main E2EE initialization effect
  useEffect(() => {
    const initializeCrypto = async () => {
      if (!userId || !shouldInitialize || isInitializingRef.current) {
        return;
      }

      if (e2eeInitialized && e2eeHasKeyPair && !e2eeError && hasCalledCallbackRef.current) {
        return;
      }

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
        
        if (result.needsSetup) {
          console.log("🔐 CRYPTO: User needs E2EE setup - performing automatic setup");
          
          // Automatisk setup for nye brukere
          const setupResult = await backupService.setupE2EEWithBackup(userId);
          
          setE2EEState(true, true, null);
          console.log("✅ CRYPTO: E2EE setup completed successfully");
          console.log("🔑 CRYPTO: Backup phrase generated (should be shown to user):", setupResult.backupPhrase);
          
          hasCalledCallbackRef.current = true;
          onInitialized?.(true);
          
        } else if (result.needsRestore) {
          console.log("🔐 CRYPTO: User needs E2EE restore - will show modal");
          setE2EEState(true, false, 'needs_restore');
          // Modal will be shown by the useEffect above
          // Don't call onInitialized here - wait for user action
          
        } else {
          setE2EEState(true, true, null);
          console.log("✅ CRYPTO: E2EE initialized - ready");
          
          hasCalledCallbackRef.current = true;
          onInitialized?.(true);
        }
        
      } catch (error) {
        console.error("❌ CRYPTO: E2EE initialization failed:", error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNetworkError = errorMessage.includes('timeout') || 
                              errorMessage.includes('network') || 
                              errorMessage.includes('fetch');
        
        if (isNetworkError) {
          setE2EEState(true, false, 'network_error');
        } else {
          setE2EEState(true, false, errorMessage);
        }
        
        hasCalledCallbackRef.current = true;
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
          hasShownRestoreModalRef.current = false; // Allow modal again if needed
          
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
      hasCalledCallbackRef.current = false;
      hasShownRestoreModalRef.current = false; // Reset modal flag
      setShowRestoreModal(false); // Hide modal
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

  return (
    <E2EERestoreModal
      visible={showRestoreModal}
      onRestore={handleRestoreSuccess}
      onSkip={handleSkipRestore}
      onClose={handleModalClose}
    />
  );
}