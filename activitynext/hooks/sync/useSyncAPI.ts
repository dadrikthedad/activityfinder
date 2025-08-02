import { useCallback } from 'react';
import { getSyncUpdates } from '@/services/initializers/syncService';
import { SyncReason } from '@/types/sync/SyncReason';
import { SyncResponseDTO } from '@/types/sync/SyncResponseDTO'; // ✅ Explicit import
import { processSyncEvent } from './eventProcessor';

export function useSyncApi() {
  /**
   * Perform delta sync with full error handling and processing
   */
  const performDeltaSync = useCallback(async (
    syncToken: string | null, 
    reason: SyncReason
  ): Promise<{
    success: boolean;
    newSyncToken?: string;
    eventsProcessed: number;
    requiresFullRefresh: boolean;
    error?: string;
  }> => {
    console.log(`🔄 Delta sync triggered (${reason})`, {
      hasSyncToken: !!syncToken,
      syncTokenPreview: syncToken ? syncToken.substring(0, 20) + '...' : 'none'
    });
    
    try {
      // Make API call
      const response: SyncResponseDTO | null = await getSyncUpdates(syncToken || undefined);
      
      if (!response) {
        throw new Error('No response received from sync API');
      }

      // ✅ Debug: Log response structure
      console.log('🔍 Debug response structure:', {
        hasMessage: 'message' in response,
        messageValue: response.message,
        responseKeys: Object.keys(response),
        responseType: typeof response
      });

      // Handle full refresh requirement
      if (response.requiresFullRefresh) {
        console.log('🔄 Full refresh required:', response.message);
        
        // Emit event for app to handle
        window.dispatchEvent(new CustomEvent('sync:fullRefreshRequired', { 
          detail: { reason: response.message } 
        }));
        
        return {
          success: true,
          requiresFullRefresh: true,
          eventsProcessed: 0,
          newSyncToken: response.newSyncToken
        };
      }

      // Process delta events
      const events = response.events || [];
      console.log(`📥 Processing ${events.length} sync events`);
      
      let processedCount = 0;
      for (const event of events) {
        try {
          await processSyncEvent(event);
          processedCount++;
          console.log(`✅ Processed event: ${event.eventType} (${processedCount}/${events.length})`);
        } catch (eventError) {
          console.error(`❌ Failed to process event ${event.eventType}:`, eventError);
          // Continue processing other events even if one fails
        }
      }

      if (events.length > 0) {
        console.log(`✅ Successfully processed ${processedCount}/${events.length} sync events`);
      }

      return {
        success: true,
        newSyncToken: response.newSyncToken,
        eventsProcessed: processedCount,
        requiresFullRefresh: false
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('❌ Delta sync failed:', errorMessage);
      
      // Emit error event
      window.dispatchEvent(new CustomEvent('sync:error', { 
        detail: { 
          error: errorMessage,
          reason,
          syncToken: syncToken ? syncToken.substring(0, 20) + '...' : 'none'
        } 
      }));

      return {
        success: false,
        error: errorMessage,
        eventsProcessed: 0,
        requiresFullRefresh: false
      };
    }
  }, []);

  /**
   * Perform sync with retry logic
   */
  const performSyncWithRetry = useCallback(async (
    syncToken: string | null,
    reason: SyncReason,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    newSyncToken?: string;
    eventsProcessed: number;
    requiresFullRefresh: boolean;
    retries: number;
    error?: string;
  }> => {
    let lastError: string | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const isRetry = attempt > 0;
      
      if (isRetry) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await performDeltaSync(syncToken, reason);
      
      if (result.success) {
        if (isRetry) {
          console.log(`✅ Sync succeeded after ${attempt} retries`);
        }
        return { ...result, retries: attempt };
      }
      
      lastError = result.error;
      
      // Don't retry if it's a full refresh requirement
      if (result.requiresFullRefresh) {
        return { ...result, retries: attempt };
      }
    }
    
    console.error(`❌ Sync failed after ${maxRetries} retries. Last error: ${lastError}`);
    return {
      success: false,
      error: lastError || 'Max retries exceeded',
      eventsProcessed: 0,
      requiresFullRefresh: false,
      retries: maxRetries
    };
  }, [performDeltaSync]);

  return {
    performDeltaSync,
    performSyncWithRetry,
  };
}