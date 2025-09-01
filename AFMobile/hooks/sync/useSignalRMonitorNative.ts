import { useEffect, useRef, useCallback, useState } from 'react';
import { getChatConnection } from '@/utils/signalr/chatHub';
import * as signalR from "@microsoft/signalr";

interface SignalRMonitorOptions {
  onConnectionChange?: (isConnected: boolean) => void;
  onFallbackRequired?: () => void;
  onRecoveryRequired?: () => void;
}

export function useSignalRMonitorNative(options: SignalRMonitorOptions = {}) {
  const [isSignalRConnected, setIsSignalRConnected] = useState(false);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Use refs to avoid stale closures
  const isConnectedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  
  // ✅ Store callback refs to ensure they're always current
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Monitor SignalR connection status
  const checkSignalRConnection = useCallback(() => {
    const connection = getChatConnection();
    
    if (connection) {
      const isConnected = connection.state === signalR.HubConnectionState.Connected;
      
      // ✅ Use ref instead of stale state
      if (isConnected !== isConnectedRef.current) {
        console.log(`📡 SignalR connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);
        
        // Check transitions BEFORE updating refs
        const wasConnected = wasConnectedRef.current;
        
        // SignalR went from connected to disconnected = trigger fallback
        if (!isConnected && wasConnected) {
          console.warn('⚠️ SignalR disconnected, fallback required');
          callbacksRef.current.onFallbackRequired?.();
        }
        
        // SignalR went from disconnected to connected = trigger recovery
        if (isConnected && !wasConnected) {
          console.log('✅ SignalR reconnected, recovery required');
          callbacksRef.current.onRecoveryRequired?.();
        }
        
        // Update state and refs AFTER processing transitions
        setIsSignalRConnected(isConnected);
        isConnectedRef.current = isConnected;
        wasConnectedRef.current = isConnected;
        callbacksRef.current.onConnectionChange?.(isConnected);
      }
    } else {
      // ✅ Check wasConnected instead of current state to avoid missing fallback triggers
      if (wasConnectedRef.current || isConnectedRef.current) {
        console.warn('📡 No SignalR connection object available - was previously connected');
        
        // Mark as disconnected
        setIsSignalRConnected(false);
        isConnectedRef.current = false;
        wasConnectedRef.current = false;
        
        // Notify callbacks
        callbacksRef.current.onConnectionChange?.(false);
        callbacksRef.current.onFallbackRequired?.();
      }
    }
  }, []); // ✅ Empty dependency array - no stale closures!

  // Start connection monitoring
  useEffect(() => {
    // console.log('🔍 Starting SignalR connection monitoring...');
    
    // Initial check
    checkSignalRConnection();
    
    // Set up interval
    connectionCheckIntervalRef.current = setInterval(checkSignalRConnection, 5000);
    
    return () => {
      console.log('🛑 Stopping SignalR connection monitoring');
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
    };
  }, [checkSignalRConnection]);

  return {
    isSignalRConnected
  };
}