import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatConnection, stopChatConnection, getChatConnection } from '@/utils/signalr/chatHub';
import * as signalR from '@microsoft/signalr';

interface UseOnlineStatusReturn {
  isOnline: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  markOnline: () => Promise<void>;
  markOffline: () => Promise<void>;
  reconnect: () => Promise<void>;
}

const HEARTBEAT_INTERVAL_MS = 30000;

export const useOnlineStatus = (): UseOnlineStatusReturn => {
  const [isOnline, setIsOnline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldBeOnlineRef = useRef(false);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const markOnlineRef = useRef<(() => Promise<void>) | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const scheduleRecovery = useCallback(() => {
    if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
    const delays = [10000, 30000, 60000, 120000, 300000];
    const index = Math.max(0, retryCountRef.current - 3);
    const delay = delays[Math.min(index, delays.length - 1)];
    recoveryTimeoutRef.current = setTimeout(async () => {
      if (shouldBeOnlineRef.current && !isOnline && !isConnecting && markOnlineRef.current) {
        await markOnlineRef.current();
      }
    }, delay);
  }, [isOnline, isConnecting]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(async () => {
      const connection = getChatConnection();
      if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        retryCountRef.current++;
        if (retryCountRef.current >= 3) {
          setIsOnline(false);
          setConnectionError("Connection lost");
          stopHeartbeat();
          if (shouldBeOnlineRef.current) scheduleRecovery();
        }
        return;
      }
      try {
        await connection.invoke('Heartbeat');
        retryCountRef.current = 0;
        if (connectionError) setConnectionError(null);
      } catch (error) {
        retryCountRef.current++;
        if (retryCountRef.current >= 3) {
          setIsOnline(false);
          setConnectionError("Connection lost");
          stopHeartbeat();
          if (shouldBeOnlineRef.current) scheduleRecovery();
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [connectionError, scheduleRecovery, stopHeartbeat]);

  const markOnline = useCallback(async () => {
    if (isConnecting) return;
    shouldBeOnlineRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await createChatConnection();
      setIsOnline(true);
      retryCountRef.current = 0;
      startHeartbeat();
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setConnectionError(errorMessage);
      setIsOnline(false);
      if (shouldBeOnlineRef.current) scheduleRecovery();
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, startHeartbeat, scheduleRecovery]);

  useEffect(() => {
    markOnlineRef.current = markOnline;
  }, [markOnline]);

  const markOffline = useCallback(async () => {
    shouldBeOnlineRef.current = false;
    stopHeartbeat();
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    try {
      await stopChatConnection();
    } catch {
      // best-effort
    }
    setIsOnline(false);
    setConnectionError(null);
  }, [stopHeartbeat]);

  const reconnect = useCallback(async () => {
    await markOffline();
    await markOnline();
  }, [markOffline, markOnline]);

  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
    };
  }, [stopHeartbeat]);

  return { isOnline, isConnecting, connectionError, markOnline, markOffline, reconnect };
};
