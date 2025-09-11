// utils/signalr/chatHub.ts
import * as signalR from "@microsoft/signalr";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { API_BASE_URL } from "@/constants/routes";
import { API_ROUTES } from "@shared/constants/routes";
import { generateDeviceId, getPlatform, getCapabilities } from "../device/UserOnlineFunctions";
import authServiceNative from '@/services/user/authServiceNative';

let chatConnection: signalR.HubConnection | null = null;
let networkUnsubscribe: (() => void) | null = null;
let appStateSubscription: any = null;
let reconnectTimeoutId: NodeJS.Timeout | null = null;
let healthCheckIntervalId: NodeJS.Timeout | null = null;
let isManualDisconnect = false;
let reconnectAttempts = 0;
let lastSuccessfulConnection = Date.now();
let currentUserId: string | null = null;
let currentDeviceId: string | null = null;

let tokenLoggedOnce = false;

// **NYE VARIABLER FOR Å FORHINDRE RACE CONDITIONS**
let connectionPromise: Promise<signalR.HubConnection> | null = null;
let listenersInitialized = false;

// Konfigurasjon
const HEALTH_CHECK_INTERVAL = 30000; // 30 sekunder
const MAX_MANUAL_RECONNECT_ATTEMPTS = 10;
const PING_TIMEOUT = 15000; // 15 sekunder timeout for ping
const CONNECTION_TIMEOUT = 20000; // 20 sekunder timeout for tilkobling
const DEVICE_COLLISION_RETRY_DELAY = 5000; // 5 sekunder ved device collision

/**
 * Custom retry delay med exponential backoff og jitter
 */
function getRetryDelay(attemptNumber: number): number {
  const baseDelay = 1000; // 1 sekund
  const maxDelay = 60000; // 1 minutt max
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
  
  // Legg til jitter (±25%) for å unngå thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
  return Math.floor(exponentialDelay + jitter);
}

// Heartbeat integration state
let lastHeartbeatSuccess = Date.now();
let heartbeatFailureCount = 0;
const MAX_HEARTBEAT_FAILURES = 2; // Maks 2 feil før reconnect

/**
 * Kalles av heartbeat når den lykkes
 */
export function notifyHeartbeatSuccess(): void {
  lastHeartbeatSuccess = Date.now();
  heartbeatFailureCount = 0;
  // Redusert logging for å unngå spam
  if (heartbeatFailureCount > 0) {
    console.log('💓 SignalR - Heartbeat recovered');
  }
}

/**
 * Kalles av heartbeat når den feiler
 */
export function notifyHeartbeatFailure(error?: any): void {
  heartbeatFailureCount++;
  console.warn(`💔 SignalR - Heartbeat failure ${heartbeatFailureCount}/${MAX_HEARTBEAT_FAILURES}:`, error);
  
  if (heartbeatFailureCount >= MAX_HEARTBEAT_FAILURES && !isManualDisconnect) {
    console.log('🚨 SignalR - Multiple heartbeat failures, checking SignalR connection');
    checkSignalRHealth();
  }
}

/**
 * Sjekker SignalR tilkobling når heartbeat feiler
 */
async function checkSignalRHealth(): Promise<void> {
  if (!chatConnection || chatConnection.state !== signalR.HubConnectionState.Connected) {
    console.log('🔍 SignalR - Connection not established, attempting reconnect');
    await attemptReconnection();
    return;
  }

  // SignalR ser ut til å være koblet til, men heartbeat feiler
  // Dette kan indikere network issues eller zombie connection
  console.log('🔍 SignalR - Connection shows as connected but heartbeat failing');
  
  try {
    // Quick lightweight check - bare se om vi kan invoke noe enkelt
    await chatConnection.invoke('GetConnectionInfo');
    console.log('✅ SignalR - Connection verified, heartbeat issue may be temporary');
  } catch (error) {
    console.warn('❌ SignalR - Connection verification failed, forcing reconnect');
    await forceReconnect();
  }
}

/**
 * Passive health monitoring basert på heartbeat
 */
function performPassiveHealthCheck(): boolean {
  const timeSinceLastHeartbeat = Date.now() - lastHeartbeatSuccess;
  const maxHeartbeatAge = 90000; // 90 sekunder (3x heartbeat interval)
  
  if (timeSinceLastHeartbeat > maxHeartbeatAge) {
    console.warn('⚠️ SignalR - No heartbeat success for', Math.round(timeSinceLastHeartbeat / 1000), 'seconds');
    return false;
  }
  
  return true;
}

/**
 * Starter lightweight health monitoring basert på heartbeat
 */
function startHealthCheck() {
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId);
  }

  // Redusert frekvens siden vi bruker heartbeat for primary health
  healthCheckIntervalId = setInterval(() => {
    if (isManualDisconnect) return;
    
    // Passive check basert på heartbeat timing
    const isHealthy = performPassiveHealthCheck();
    
    if (!isHealthy) {
      console.log('🚨 SignalR - Passive health check failed, investigating...');
      checkSignalRHealth();
    }
  }, 60000); // Sjekk hver minutt istedenfor hver 30. sekund
}

/**
 * Stopper health check interval
 */
function stopHealthCheck() {
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId);
    healthCheckIntervalId = null;
  }
}

/**
 * Setup global listeners - kalles kun én gang
 */
function initializeGlobalListeners() {
  if (listenersInitialized) {
    return;
  }

  console.log('🔧 SignalR - Initializing global listeners...');
  listenersInitialized = true;

  // Setup network state listeners
  networkUnsubscribe = NetInfo.addEventListener(state => {
    console.log('📱 SignalR - Network state changed:', {
      connected: state.isConnected,
      type: state.type,
      signalrState: chatConnection?.state
    });
   
    if (state.isConnected && !isManualDisconnect) {
      if (chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        console.log('🌐 SignalR - Device came online, attempting reconnect');
        attemptReconnection();
      }
    } else if (!state.isConnected) {
      console.log('📵 SignalR - Device went offline');
    }
  });

  // Setup app state listeners
  appStateSubscription = AppState.addEventListener('change', async nextAppState => {
    console.log('📱 SignalR - App state changed:', nextAppState);
    
    if (nextAppState === 'active' && !isManualDisconnect) {
      // Sjekk om bruker har endret seg mens appen var i bakgrunnen
      if (await hasUserChanged()) {
        console.log('👤 SignalR - User changed while app was backgrounded');
        await recreateConnection();
        return;
      }
      
      // App ble aktiv, sjekk tilkobling
      if (chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        console.log('👁️ SignalR - App became active, checking connection');
        attemptReconnection();
      } else if (chatConnection?.state === signalR.HubConnectionState.Connected) {
        // Passive check når appen blir aktiv
        const isHealthy = performPassiveHealthCheck();
        if (!isHealthy) {
          console.log('👁️ SignalR - App became active, heartbeat status unhealthy');
          checkSignalRHealth();
        }
      }
    } else if (nextAppState === 'background') {
      console.log('📱 SignalR - App went to background');
      // Ikke disconnect, la SignalR håndtere det selv
    }
  });
}

/**
 * Cleanup global listeners
 */
function cleanupGlobalListeners() {
  console.log('🧹 SignalR - Cleaning up global listeners...');
  
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  
  listenersInitialized = false;
}

/**
 * Håndterer device collision errors
 */
function handleDeviceCollision(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Sjekk for device collision indikatorer
  const isDeviceCollision = 
    errorMessage.includes('device') && 
    (errorMessage.includes('collision') || 
     errorMessage.includes('already connected') || 
     errorMessage.includes('duplicate') ||
     errorMessage.includes('conflict'));
     
  if (isDeviceCollision) {
    console.log('🔀 SignalR - Device collision detected, will retry with new device ID');
    return true;
  }
  
  return false;
}

/**
 * Genererer ny device ID ved collision
 */
async function regenerateDeviceId(): Promise<string> {
  console.log('🆔 SignalR - Regenerating device ID due to collision');
  
  // Generer helt ny device ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const newDeviceId = `${await generateDeviceId()}_${timestamp}_${random}`;
  
  // Lagre den nye ID-en
  await AsyncStorage.setItem('deviceId', newDeviceId);
  currentDeviceId = newDeviceId;
  
  console.log('🆔 SignalR - New device ID generated:', newDeviceId.substring(0, 20) + '...');
  return newDeviceId;
}

/**
 * Manual reconnection med retry logic og device collision handling
 */
async function attemptReconnection(): Promise<void> {
  if (isManualDisconnect || reconnectAttempts >= MAX_MANUAL_RECONNECT_ATTEMPTS) {
    console.log(`🛑 SignalR - Skipping reconnect (manual: ${isManualDisconnect}, attempts: ${reconnectAttempts})`);
    return;
  }

  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
  }

  reconnectAttempts++;
  const delay = getRetryDelay(reconnectAttempts - 1);
  
  console.log(`🔄 SignalR - Manual reconnect attempt ${reconnectAttempts}/${MAX_MANUAL_RECONNECT_ATTEMPTS} in ${delay}ms`);

  reconnectTimeoutId = setTimeout(async () => {
    try {
      if (chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        console.log('🔌 SignalR - Starting manual reconnection...');
        await chatConnection.start();
      }
    } catch (error) {
      console.error('❌ SignalR - Manual reconnect failed:', error);
      
      // Sjekk for device collision
      if (handleDeviceCollision(error)) {
        console.log('🔄 SignalR - Attempting reconnect with new device ID after collision');
        await recreateConnectionWithNewDevice();
        return;
      }
      
      // Hvis vi ikke har nådd max attempts, prøv igjen
      if (reconnectAttempts < MAX_MANUAL_RECONNECT_ATTEMPTS) {
        await attemptReconnection();
      } else {
        console.error('🛑 SignalR - Max reconnection attempts reached');
        await recreateConnection();
      }
    }
  }, delay);
}

/**
 * Gjenoppretter tilkoblingen med ny device ID
 */
async function recreateConnectionWithNewDevice(): Promise<void> {
  console.log('🔄 SignalR - Recreating connection with new device ID...');
  
  try {
    await stopChatConnection();
    await regenerateDeviceId();
    await new Promise(resolve => setTimeout(resolve, DEVICE_COLLISION_RETRY_DELAY));
    await createChatConnection();
  } catch (error) {
    console.error('❌ SignalR - Failed to recreate connection with new device ID:', error);
    // Fall back til normal recreation
    await recreateConnection();
  }
}

/**
 * Gjenoppretter tilkoblingen helt fra scratch
 */
async function recreateConnection(): Promise<void> {
  console.log('🔄 SignalR - Recreating connection from scratch...');
  
  try {
    await stopChatConnection();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Vent litt
    await createChatConnection();
  } catch (error) {
    console.error('❌ SignalR - Failed to recreate connection:', error);
  }
}

/**
 * Reset reconnect state etter vellykket tilkobling
 */
function resetReconnectState() {
  reconnectAttempts = 0;
  lastSuccessfulConnection = Date.now();
  
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

/**
 * Sjekker om vi har skiftet bruker
 */
async function hasUserChanged(): Promise<boolean> {
  const storedUserId = await AsyncStorage.getItem('userId');
  return currentUserId !== storedUserId;
}

/**
 * **HOVEDFORBEDRING** - Returnerer én delt tilkobling med race condition protection
 */
export async function createChatConnection(): Promise<signalR.HubConnection> {
  const storedUserId = await AsyncStorage.getItem('userId');
  
  // Sjekk om bruker har endret seg
  if (currentUserId && currentUserId !== storedUserId) {
    console.log('👤 SignalR - User changed, recreating connection');
    await stopChatConnection();
    chatConnection = null;
    connectionPromise = null; // Reset promise også
  }
  
  currentUserId = storedUserId;

  // **RACE CONDITION PROTECTION**
  if (chatConnection && chatConnection.state !== signalR.HubConnectionState.Disconnected) {
    console.log('🔄 SignalR - Returning existing connection');
    return chatConnection;
  }

  // Hvis vi allerede holder på å opprette en connection, vent på den
  if (connectionPromise) {
    console.log('🔄 SignalR - Waiting for ongoing connection creation...');
    return connectionPromise;
  }

  // Opprett ny connection med promise protection
  connectionPromise = createConnectionInternal();
  
  try {
    const result = await connectionPromise;
    connectionPromise = null; // Reset etter vellykket opprettelse
    return result;
  } catch (error) {
    connectionPromise = null; // Reset ved feil også
    throw error;
  }
}

/**
 * Intern metode som faktisk oppretter tilkoblingen
 */
async function createConnectionInternal(): Promise<signalR.HubConnection> {
  try {
    // Initialize global listeners kun én gang
    initializeGlobalListeners();
    
    // Generer eller hent device ID
    if (!currentDeviceId) {
      const storedDeviceId = await AsyncStorage.getItem('deviceId');
      currentDeviceId = storedDeviceId || await generateDeviceId();
      
      if (!storedDeviceId) {
        await AsyncStorage.setItem('deviceId', currentDeviceId);
      }
    }
    
    const deviceId = currentDeviceId;
    const platform = getPlatform();
    const capabilities = getCapabilities();
   
    // Legg til bruker-spesifikk info i URL
    const hubUrl = `${API_BASE_URL}${API_ROUTES.chatHub}?deviceId=${encodeURIComponent(deviceId)}&platform=${encodeURIComponent(platform)}&capabilities=${encodeURIComponent(capabilities.join(','))}&userId=${encodeURIComponent(currentUserId || '')}`;
   
    console.log('🚀 SignalR - Creating new connection for user:', currentUserId?.substring(0, 8) + '...');
    console.log('📱 SignalR - Device ID:', deviceId.substring(0, 20) + '...');

    
    
    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          try {
            // Force refresh check since SignalR connections can be long-lived
            const isExpiringSoon = await authServiceNative.isTokenExpiringSoon();
            
            if (isExpiringSoon) {
              console.log('🔄 SignalR - Token expiring soon, refreshing...');
              await authServiceNative.refreshAccessToken();
            }
            
            const token = await authServiceNative.getAccessToken();
            
            // **REDUSERT LOGGING** - kun log én gang og ikke token preview hver gang
            if (!token) {
              console.error('🔴 SignalR - No access token available');
              throw new Error('No token available');
            }
            
            if (!tokenLoggedOnce && token) {
              console.log('🔍 SignalR token status: ready');
              tokenLoggedOnce = true;
            }
            return token;
          } catch (error) {
            console.error('🔴 SignalR accessTokenFactory failed:', error);
            throw error;
          }
        }
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          const delay = getRetryDelay(retryContext.previousRetryCount);
          console.log(`🔄 SignalR automatic reconnect attempt ${retryContext.previousRetryCount + 1}, delay: ${delay}ms`);
          return delay;
        }
      })
      .build();

    // Event handlers
    chatConnection.onclose(async (error) => {
      console.log('🔌 SignalR - Connection closed:', error?.message || 'No error');
      stopHealthCheck();
      
      // Sjekk for device collision i close event
      if (error && handleDeviceCollision(error)) {
        console.log('🔀 SignalR - Device collision on close, will recreate with new device ID');
        await recreateConnectionWithNewDevice();
        return;
      }
      
      if (!isManualDisconnect) {
        console.log('⚠️ SignalR - Unexpected disconnect, will attempt reconnect');
        await attemptReconnection();
      }
    });

    chatConnection.onreconnecting(error => {
      console.log('🔄 SignalR - Reconnecting...', error?.message || 'No error');
      stopHealthCheck();
    });

    chatConnection.onreconnected(async (connectionId) => {
      console.log('✅ SignalR - Reconnected with ID:', connectionId);
      
      // Sjekk om bruker har endret seg under reconnection
      if (await hasUserChanged()) {
        console.log('👤 SignalR - User changed during reconnection, disconnecting');
        await chatConnection?.stop();
        return;
      }
      
      resetReconnectState();
      startHealthCheck();
    });

    // Håndter multi-device events
    chatConnection.on('DeviceCollision', async (message: string) => {
      console.log('🔀 SignalR - Device collision event received:', message);
      await recreateConnectionWithNewDevice();
    });

    chatConnection.on('UserLoggedInElsewhere', async (data: { message: string, deviceInfo?: string }) => {
      console.log('👤 SignalR - User logged in elsewhere:', data.message);
      console.log('📱 SignalR - Other device info:', data.deviceInfo);
      
      // Emit event som andre deler av appen kan lytte på
      // Du kan bruke EventEmitter eller din egen event system
      // DeviceEventEmitter.emit('signalr:userLoggedInElsewhere', data);
      
      // Ikke disconnect automatisk - la brukeren bestemme
    });

    chatConnection.on('ForceDisconnect', async (data: { reason: string, allowReconnect?: boolean }) => {
      console.log('🚫 SignalR - Force disconnect:', data.reason);
      
      isManualDisconnect = !data.allowReconnect;
      
      await chatConnection?.stop();
      
      // Emit event for UI handling
      // DeviceEventEmitter.emit('signalr:forceDisconnect', data);
      
      if (!data.allowReconnect) {
        console.log('🚫 SignalR - Permanent disconnect, user action required');
      }
    });

    // Start tilkobling
    isManualDisconnect = false;
    console.log('🔌 SignalR - Starting connection...');
    await chatConnection.start();
    
    resetReconnectState();
    startHealthCheck();
    
    return chatConnection;
    
  } catch (error) {
    console.error('❌ SignalR - Failed to create/start connection:', error);
    
    // Håndter device collision ved oppstart
    if (handleDeviceCollision(error)) {
      console.log('🔀 SignalR - Device collision on startup, retrying with new device ID');
      await regenerateDeviceId();
      await new Promise(resolve => setTimeout(resolve, DEVICE_COLLISION_RETRY_DELAY));
      
      if (reconnectAttempts < MAX_MANUAL_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        return createConnectionInternal(); // Kall intern metode direkte
      }
    }
    
    // Prøv å recreate hvis initial connection feiler
    if (reconnectAttempts < MAX_MANUAL_RECONNECT_ATTEMPTS) {
      console.log('🔄 SignalR - Retrying connection creation...');
      await new Promise(resolve => setTimeout(resolve, getRetryDelay(reconnectAttempts)));
      reconnectAttempts++;
      return createConnectionInternal(); // Kall intern metode direkte
    }
    
    throw error;
  }
}

/**
 * Returnerer eksisterende tilkobling uten å opprette ny.
 */
export function getChatConnection(): signalR.HubConnection | null {
  return chatConnection;
}

/**
 * Sjekker om tilkoblingen er aktiv og sunn (inkluderer heartbeat status)
 */
export function isConnectionHealthy(): boolean {
  const signalRConnected = chatConnection?.state === signalR.HubConnectionState.Connected;
  const heartbeatHealthy = performPassiveHealthCheck();
  
  return signalRConnected && heartbeatHealthy;
}

/**
 * Tvinger reconnection hvis tilkobling er problematisk
 */
export async function forceReconnect(): Promise<void> {
  console.log('🔄 SignalR - Forcing reconnection...');
  if (chatConnection?.state === signalR.HubConnectionState.Connected) {
    await chatConnection.stop();
  }
  await attemptReconnection();
}

/**
 * Håndterer brukerbytte - disconnect og reset
 */
export async function handleUserSwitch(): Promise<void> {
  console.log('👤 SignalR - Handling user switch...');
  await stopChatConnection();
  currentUserId = null;
  // Behold deviceId ved user switch - samme enhet, ny bruker
  // currentDeviceId = null; // Kommenter ut denne
}

/**
 * Stopper tilkoblingen og rydder opp ressurser
 */
export async function stopChatConnection(): Promise<void> {
  console.log('🛑 SignalR - Stopping connection...');
  
  isManualDisconnect = true;
  
  // Cleanup intervals og timeouts
  stopHealthCheck();
  
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  // Stop SignalR connection
  if (chatConnection) {
    try {
      await chatConnection.stop();
    } catch (error) {
      console.error('❌ SignalR - Error stopping connection:', error);
    }
    chatConnection = null;
  }
 
  // Cleanup global listeners
  cleanupGlobalListeners();
  
  // Reset state
  reconnectAttempts = 0;
  isManualDisconnect = false;
  connectionPromise = null; // **VIKTIG**: Reset connection promise
  tokenLoggedOnce = false;
  
  // Reset heartbeat state
  lastHeartbeatSuccess = Date.now();
  heartbeatFailureCount = 0;
  
  console.log('✅ SignalR - Connection stopped and cleaned up');
}

/**
 * Debug info for troubleshooting
 */
export function getConnectionDebugInfo() {
  const timeSinceLastSuccess = Date.now() - lastSuccessfulConnection;
  
  return {
    state: chatConnection?.state || 'null',
    connectionId: chatConnection?.connectionId || 'none',
    currentUserId: currentUserId?.substring(0, 8) + '...' || 'none',
    currentDeviceId: currentDeviceId?.substring(0, 20) + '...' || 'none',
    reconnectAttempts,
    isManualDisconnect,
    timeSinceLastSuccess: `${Math.round(timeSinceLastSuccess / 1000)}s`,
    hasHealthCheck: !!healthCheckIntervalId,
    hasReconnectTimer: !!reconnectTimeoutId,
    lastHeartbeatSuccess: `${Math.round((Date.now() - lastHeartbeatSuccess) / 1000)}s ago`,
    heartbeatFailureCount,
    heartbeatHealthy: performPassiveHealthCheck(),
    hasConnectionPromise: !!connectionPromise,
    listenersInitialized,
  };
}