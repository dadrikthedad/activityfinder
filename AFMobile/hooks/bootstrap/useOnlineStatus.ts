// hooks/useOnlineStatus.ts (React Native version)
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { markOnlineWithDefaults,
  markOfflineWithDefaults, 
  sendHeartbeatSafe,
 } from '@/services/bootstrap/onlineStatusService';
import NetInfo from '@react-native-community/netinfo';
// 🆕 Import SignalR heartbeat notifications
import { notifyHeartbeatSuccess, notifyHeartbeatFailure } from '@/utils/signalr/chatHub';
import { AuthError } from '@shared/types/error/AuthError';


interface UseOnlineStatusReturn {
  isOnline: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  markOnline: () => Promise<void>;
  markOffline: () => Promise<void>;
  reconnect: () => Promise<void>;
}

let globalHeartbeatInterval: NodeJS.Timeout | null = null;
let globalHeartbeatId: string | null = null;


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
  if (globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval);
    globalHeartbeatInterval = null;
    console.log(`⏹️ Global heartbeat stopped: ${globalHeartbeatId}`);
    globalHeartbeatId = null;
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

  // 🔧 Enhanced heartbeat with SignalR integration
  const startHeartbeat = useCallback((intervalMs: number = 30000) => {
    // Stop eksisterende global heartbeat først
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
      console.log(`🛑 Stopping previous heartbeat: ${globalHeartbeatId}`);
    }
    
    const heartbeatId = Math.random().toString(36).substring(2, 8);
    globalHeartbeatId = heartbeatId;
    
    globalHeartbeatInterval = setInterval(async () => {
      // console.log(`💓 Global heartbeat (ID: ${heartbeatId})`);
      
      try {
        const success = await sendHeartbeatSafe();
        if (success) {
          notifyHeartbeatSuccess();
          retryCountRef.current = 0;
          if (connectionError) {
            setConnectionError(null);
          }
        } else {
          throw new Error('Heartbeat failed');
        }
      } catch (error) {
        console.warn("⚠️ Heartbeat failed:", error);
        notifyHeartbeatFailure(error);
        retryCountRef.current++;
        
        if (retryCountRef.current >= 3) {
          console.error("❌ Multiple heartbeat failures - marking offline");
          setIsOnline(false);
          setConnectionError("Connection lost");
          stopHeartbeat();
          
          if (shouldBeOnlineRef.current) {
            scheduleRecovery();
          }
        }
      }
    }, intervalMs);
    
    // console.log(`✅ Global heartbeat started (${intervalMs}ms) - ID: ${heartbeatId}`);
  }, [connectionError, scheduleRecovery]);

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
      // console.log("🚀 Marking user as online...");

      const result = await markOnlineWithDefaults(['signalr', 'push', 'websocket']);

      if (result) {
        // console.log("✅ User marked as online successfully");
        setIsOnline(true);
        startHeartbeat(30000); // 🔧 30 second interval
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
      
      // 🆕 Type-safe error handling
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 🆕 Stop auto-recovery på auth-feil
      if (error instanceof AuthError || errorMessage.includes('Session expired')) {
        console.log("🔐 Authentication failed - stopping auto-recovery");
        shouldBeOnlineRef.current = false;
        setConnectionError("Please log in again");
        // Her kan du trigge redirect til login
        return;
      }
    
      // 🆕 Notify SignalR about the connection failure
      notifyHeartbeatFailure(error);
    
      setConnectionError(errorMessage);
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
  // I useOnlineStatus, legg til debouncing for network events
const networkEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    // Debounce network events - vent 1 sekund før handling
    if (networkEventTimeoutRef.current) {
      clearTimeout(networkEventTimeoutRef.current);
    }
    
    networkEventTimeoutRef.current = setTimeout(() => {
      if (state.isConnected && state.isInternetReachable) {
        console.log("🌐 Network back online (debounced)");
        
        if (shouldBeOnlineRef.current && !isOnline && !isConnecting) {
          console.log("🌐 Network restored and should be online - attempting recovery");
          markOnline();
        }
      } else {
        console.log("📡 Network went offline");
        setIsOnline(false);
        stopHeartbeat();
        setConnectionError("Network offline");
        notifyHeartbeatFailure(new Error('Network offline'));
      }
    }, 1000); // 1 sekund debounce
  });

  return () => {
    unsubscribe();
    if (networkEventTimeoutRef.current) {
      clearTimeout(networkEventTimeoutRef.current);
    }
  };
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