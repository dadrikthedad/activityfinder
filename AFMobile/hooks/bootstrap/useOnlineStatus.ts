// hooks/useOnlineStatus.ts (React Native version)
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { markOnlineWithDefaults,
  markOfflineWithDefaults, 
  sendHeartbeatSafe,
 } from '@/services/bootstrap/onlineStatusService';
 import NetInfo from '@react-native-community/netinfo';

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
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const shouldBeOnlineRef = useRef(false); // Track if we SHOULD be online
  
  // Use ref to avoid circular dependency
  const markOnlineRef = useRef<(() => Promise<void>) | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('⏹️ Heartbeat stopped');
    }
    retryCountRef.current = 0;
  }, []);

  // Schedule recovery with exponential backoff
  const scheduleRecovery = useCallback(() => {
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }
    
    // Exponential backoff: 10s, 30s, 60s, 120s, max 300s (5min)
    const delays = [10000, 30000, 60000, 120000, 300000];
    const delay = delays[Math.min(retryCountRef.current - 3, delays.length - 1)];
    
    console.log(`⏰ Scheduling recovery attempt in ${delay}ms`);
    
    recoveryTimeoutRef.current = setTimeout(async () => {
      if (shouldBeOnlineRef.current && !isOnline && !isConnecting && markOnlineRef.current) {
        console.log("🔄 Attempting auto-recovery...");
        await markOnlineRef.current();
      }
    }, delay);
  }, [isOnline, isConnecting]);

  // Enhanced heartbeat with auto-recovery
  const startHeartbeat = useCallback((intervalMs: number = 60000) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(async () => {
      const success = await sendHeartbeatSafe();
      
      if (!success) {
        console.warn("⚠️ Heartbeat failed");
        retryCountRef.current++;
        
        // After 3 failed heartbeats, mark as offline but schedule recovery
        if (retryCountRef.current >= 3) {
          console.error("❌ Multiple heartbeat failures - marking offline but will auto-recover");
          setIsOnline(false);
          setConnectionError("Connection lost");
          stopHeartbeat();
          
          // Schedule auto-recovery if we should be online
          if (shouldBeOnlineRef.current) {
            scheduleRecovery();
          }
        }
      } else {
        // Reset retry count on successful heartbeat
        retryCountRef.current = 0;
        if (connectionError) {
          setConnectionError(null);
        }
      }
    }, intervalMs);
    
    console.log(`✅ Heartbeat started (${intervalMs}ms interval)`);
  }, [connectionError, scheduleRecovery, stopHeartbeat]);

  // Enhanced markOnline
  const markOnline = useCallback(async () => {
    if (isConnecting) {
      console.log("🔄 Already connecting, skipping...");
      return;
    }

    shouldBeOnlineRef.current = true; // Mark that we SHOULD be online
    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log("🚀 Marking user as online...");

      const result = await markOnlineWithDefaults(['signalr', 'push', 'websocket']);

      if (result) {
        console.log("✅ User marked as online successfully");
        setIsOnline(true);
        startHeartbeat(60000);
        retryCountRef.current = 0;
        
        // Clear any pending recovery
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
          recoveryTimeoutRef.current = null;
        }
      } else {
        throw new Error("Failed to mark user online - no response");
      }
      
    } catch (error) {
      console.error("❌ Failed to mark user online:", error);
      setConnectionError(error instanceof Error ? error.message : "Failed to connect");
      setIsOnline(false);
      
      // Schedule recovery since we should be online
      if (shouldBeOnlineRef.current) {
        scheduleRecovery();
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, startHeartbeat, scheduleRecovery]);

  // Set the ref after markOnline is defined
  useEffect(() => {
    markOnlineRef.current = markOnline;
  }, [markOnline]);

  // Enhanced markOffline
  const markOffline = useCallback(async () => {
    try {
      console.log("⏹️ Marking user as offline...");

      shouldBeOnlineRef.current = false; // We no longer should be online
      
      await markOfflineWithDefaults();
      stopHeartbeat();
      
      setIsOnline(false);
      setConnectionError(null);
      console.log("✅ User marked as offline successfully");
      
      // Clear any pending recovery
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.warn("⚠️ Failed to mark user offline:", error);
      // Still mark as offline locally
      shouldBeOnlineRef.current = false;
      setIsOnline(false);
      stopHeartbeat();
    }
  }, [stopHeartbeat]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    console.log("🔄 Manual reconnect requested...");
    await markOffline();
    await markOnline();
  }, [markOffline, markOnline]);

  // App state changes (equivalent to page visibility)
  useEffect(() => {
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Don't immediately mark offline - user might be switching apps briefly
        backgroundTimer = setTimeout(() => {
          markOffline();
        }, 60000); // 1 minute delay
      } else if (nextAppState === 'active') {
        // Clear the offline timer if user comes back
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        
        // Auto-recovery: Try to come back online when app becomes active
        if (shouldBeOnlineRef.current && !isOnline && !isConnecting) {
          console.log("📱 App active and should be online - attempting recovery");
          markOnline();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
    };
  }, [isOnline, isConnecting, markOffline, markOnline]);

  // Network status changes with auto-recovery
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        console.log("🌐 Network back online");
        // Auto-recovery: Try to come back online when network returns
        if (shouldBeOnlineRef.current && !isOnline && !isConnecting) {
          console.log("🌐 Network restored and should be online - attempting recovery");
          markOnline();
        }
      } else {
        console.log("📡 Network went offline");
        setIsOnline(false);
        stopHeartbeat();
        setConnectionError("Network offline");
        // Note: shouldBeOnlineRef stays true - we'll recover when network returns
      }
    });

    return unsubscribe;
  }, [isOnline, isConnecting, markOnline, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
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