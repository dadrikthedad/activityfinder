// @/hooks/useOnlineStatus.ts (Clean version - no SignalR)
import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  markOnlineWithDefaults, 
  markOfflineWithDefaults, 
  sendHeartbeatSafe,
} from '@/services/onlineStatusService';
import { API_BASE_URL } from '@/constants/routes';
import { markOfflineBeacon } from '@/functions/bootstrap/UserOnlineFunctions';

interface UseOnlineStatusReturn {
  isOnline: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  markOnline: () => Promise<void>;
  markOffline: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export const useOnlineStatus = (): UseOnlineStatusReturn => {
  const [isOnline, setIsOnline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start heartbeat interval
  const startHeartbeat = useCallback((intervalMs: number = 30000) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(async () => {
      const success = await sendHeartbeatSafe();
      if (!success) {
        console.warn("⚠️ Heartbeat failed - marking as offline");
        setIsOnline(false);
        setConnectionError("Heartbeat failed");
      }
    }, intervalMs);
    
    console.log(`✅ Heartbeat started (${intervalMs}ms interval)`);
  }, []);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('⏹️ Heartbeat stopped');
    }
  }, []);

  // Mark user as online
  const markOnline = useCallback(async () => {
    if (isConnecting) {
      console.log("🔄 Already connecting, skipping...");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log("🚀 Marking user as online...");

      const result = await markOnlineWithDefaults(['signalr', 'push', 'websocket']);

      if (result) {
        console.log("✅ User marked as online successfully");
        setIsOnline(true);
        
        // Start heartbeat to maintain online status
        startHeartbeat(30000);
      } else {
        throw new Error("Failed to mark user online - no response");
      }
      
    } catch (error) {
      console.error("❌ Failed to mark user online:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to connect");
      setIsOnline(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, startHeartbeat]);

  // Mark user as offline
  const markOffline = useCallback(async () => {
    try {
      console.log("⏹️ Marking user as offline...");

      await markOfflineWithDefaults();
      stopHeartbeat();
      
      setIsOnline(false);
      setConnectionError(null);
      console.log("✅ User marked as offline successfully");
      
    } catch (error) {
      console.warn("⚠️ Failed to mark user offline:", error);
      // Still mark as offline locally even if API fails
      setIsOnline(false);
      stopHeartbeat();
    }
  }, [stopHeartbeat]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    console.log("🔄 Reconnecting online status...");
    await markOffline();
    await markOnline();
  }, [markOffline, markOnline]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markOffline();
      } else if (document.visibilityState === 'visible' && !isOnline) {
        markOnline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOnline, markOffline, markOnline]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => markOfflineBeacon(API_BASE_URL);
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      markOffline(); // Cleanup on component unmount
    };
  }, [markOffline]);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Network back online");
      if (!isOnline) markOnline();
    };

    const handleOffline = () => {
      console.log("📡 Network went offline");
      setIsOnline(false);
      stopHeartbeat();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, markOnline, stopHeartbeat]);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => stopHeartbeat();
  }, [stopHeartbeat]);

  return {
    isOnline,
    isConnecting,
    connectionError,
    markOnline,
    markOffline,
    reconnect,
  };
};