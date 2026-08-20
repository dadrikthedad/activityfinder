import { useCallback, useRef } from 'react';
import { SyncReason } from '@shared/types/sync/SyncReason';
import { useSyncApiNative } from './useSyncAPINative';

export function useDeltaSyncNative() {
  const isRunningRef = useRef(false);
  const { performSyncWithRetry } = useSyncApiNative();

  const performDeltaSync = useCallback(async (reason: SyncReason): Promise<void> => {
    if (isRunningRef.current) {
      console.log(`⏸️ Delta sync skipped — already running (${reason})`);
      return;
    }

    isRunningRef.current = true;
    try {
      const result = await performSyncWithRetry(reason);
      if (result.success) {
        console.log(`✅ Sync completed (${reason}): ${result.eventsProcessed} events`);
      } else {
        console.error(`❌ Sync failed (${reason}):`, result.error);
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [performSyncWithRetry]);

  return { performDeltaSync };
}
