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

  const isConnectedRef = useRef(false);
  const wasConnectedRef = useRef(false);

  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const checkSignalRConnection = useCallback(() => {
    const connection = getChatConnection();

    if (connection) {
      const isConnected = connection.state === signalR.HubConnectionState.Connected;

      if (isConnected !== isConnectedRef.current) {
        console.log(`📡 SignalR connection status changed: ${isConnected ? 'Connected' : 'Disconnected'}`);

        const wasConnected = wasConnectedRef.current;

        if (!isConnected && wasConnected) {
          console.warn('⚠️ SignalR disconnected, fallback required');
          callbacksRef.current.onFallbackRequired?.();
        }

        if (isConnected && !wasConnected) {
          console.log('✅ SignalR reconnected, recovery required');
          callbacksRef.current.onRecoveryRequired?.();
        }

        setIsSignalRConnected(isConnected);
        isConnectedRef.current = isConnected;
        wasConnectedRef.current = isConnected;
        callbacksRef.current.onConnectionChange?.(isConnected);
      }
    } else {
      if (wasConnectedRef.current || isConnectedRef.current) {
        console.warn('📡 No SignalR connection object available - was previously connected');

        setIsSignalRConnected(false);
        isConnectedRef.current = false;
        wasConnectedRef.current = false;

        callbacksRef.current.onConnectionChange?.(false);
        callbacksRef.current.onFallbackRequired?.();
      }
    }
  }, []);

  useEffect(() => {
    checkSignalRConnection();
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
