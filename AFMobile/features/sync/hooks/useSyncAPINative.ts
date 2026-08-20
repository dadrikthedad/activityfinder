import { useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getSyncUpdates } from '@/features/sync/services/syncService';
import { SyncReason } from '@shared/types/sync/SyncReason';
import { processSyncEventNative } from '../eventProcessorNative';

export function useSyncApiNative() {
  const performDeltaSync = useCallback(async (
    reason: SyncReason
  ): Promise<{
    success: boolean;
    eventsProcessed: number;
    requiresFullRefresh: boolean;
    error?: string;
  }> => {
    try {
      const response = await getSyncUpdates();

      if (!response) {
        throw new Error('No response received from sync API');
      }

      if (response.requiresFullRefresh) {
        console.log('🔄 Full refresh required by backend');
        DeviceEventEmitter.emit('sync:fullRefreshRequired', {});
        return { success: true, requiresFullRefresh: true, eventsProcessed: 0 };
      }

      const events = response.events ?? [];
      let processedCount = 0;
      for (const event of events) {
        try {
          await processSyncEventNative(event);
          processedCount++;
        } catch (err) {
          console.error(`❌ Failed to process event ${event.eventType}:`, err);
        }
      }

      return { success: true, eventsProcessed: processedCount, requiresFullRefresh: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      DeviceEventEmitter.emit('sync:error', { error: errorMessage, reason });
      return { success: false, error: errorMessage, eventsProcessed: 0, requiresFullRefresh: false };
    }
  }, []);

  const performSyncWithRetry = useCallback(async (
    reason: SyncReason,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    eventsProcessed: number;
    requiresFullRefresh: boolean;
    retries: number;
    error?: string;
  }> => {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await performDeltaSync(reason);
      if (result.success) return { ...result, retries: attempt };
      if (result.requiresFullRefresh) return { ...result, retries: attempt };

      lastError = result.error;
    }

    return { success: false, error: lastError, eventsProcessed: 0, requiresFullRefresh: false, retries: maxRetries };
  }, [performDeltaSync]);

  return { performDeltaSync, performSyncWithRetry };
}
