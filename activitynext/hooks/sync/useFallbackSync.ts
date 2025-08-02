import { useEffect, useRef, useCallback, useState } from 'react';
import { SyncReason } from '@/types/sync/SyncReason';

interface FallbackSyncOptions {
  performSync: (reason: SyncReason) => Promise<void>;
  interval?: number;
}

export function useFallbackSync({ performSync, interval = 30000 }: FallbackSyncOptions) {
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Store callbacks in ref to avoid stale closures
  const performSyncRef = useRef(performSync);
  performSyncRef.current = performSync;

  const startFallback = useCallback(() => {
    if (isFallbackActive) {
      console.warn('⚠️ Fallback sync already active, ignoring start request');
      return;
    }
    
    console.warn('🔄 Starting fallback sync mode');
    setIsFallbackActive(true);
    
    // Start interval immediately
    fallbackIntervalRef.current = setInterval(() => {
      console.log('🔄 Fallback sync tick');
      performSyncRef.current('fallback').catch(error => {
        console.error('❌ Fallback sync failed:', error);
        // Continue interval even if sync fails
      });
    }, interval);
    
    // ✅ OPTIONAL: Immediate first sync when starting fallback
    console.log('🚀 Performing immediate fallback sync');
    performSyncRef.current('fallback').catch(error => {
      console.error('❌ Initial fallback sync failed:', error);
    });
    
  }, [isFallbackActive, interval]);

  const stopFallback = useCallback(() => {
    if (!isFallbackActive) {
      console.log('ℹ️ Fallback sync already stopped, ignoring stop request');
      return;
    }
    
    console.log('✅ Stopping fallback sync mode');
    setIsFallbackActive(false);
    
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, [isFallbackActive]);

  // ✅ Force stop (for emergencies or debugging)
  const forceStopFallback = useCallback(() => {
    console.log('🛑 Force stopping fallback sync');
    setIsFallbackActive(false);
    
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fallbackIntervalRef.current) {
        console.log('🧹 Cleaning up fallback sync on unmount');
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, []);

  // ✅ Debug logging
  useEffect(() => {
    console.log(`📊 Fallback sync status: ${isFallbackActive ? 'ACTIVE' : 'INACTIVE'} (interval: ${interval}ms)`);
  }, [isFallbackActive, interval]);

  return {
    isFallbackActive,
    startFallback,
    stopFallback,
    forceStopFallback // ✅ Extra for debugging
  };
}