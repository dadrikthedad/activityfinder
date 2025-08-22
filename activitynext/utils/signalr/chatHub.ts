// utils/signalr/chatHub.ts
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL, API_ROUTES } from "@/constants/api/routes";
import { generateDeviceId } from "@/functions/bootstrap/UserOnlineFunctions";
import { getPlatform } from "@/functions/bootstrap/UserOnlineFunctions";
import { getCapabilities } from "@/functions/bootstrap/UserOnlineFunctions";

// Global token accessor - will be set by the component using useAuth
let getAuthToken: (() => string | null) | null = null;

let chatConnection: signalR.HubConnection | null = null;
let reconnectTimeoutId: NodeJS.Timeout | null = null;
const maxReconnectAttempts = 5;
let currentReconnectAttempts = 0;
let isManuallyDisconnected = false;

// Type definitions
interface JWTPayload {
  exp: number;
  [key: string]: unknown;
}

/**
 * Set the token getter function from useAuth
 */
export function setAuthTokenGetter(tokenGetter: () => string | null): void {
  getAuthToken = tokenGetter;
}

/**
 * Get current token from auth context
 */
function getCurrentToken(): string | null {
  if (getAuthToken) {
    return getAuthToken();
  }
  return null;
}

/**
 * Sjekker om tokenet er gyldig
 */
function hasValidToken(): boolean {
  const token = getCurrentToken();
  if (!token) return false;
  
  try {
    // Enkel sjekk av JWT token expiry hvis du bruker JWT
    const payload = JSON.parse(atob(token.split('.')[1])) as JWTPayload;
    const now = Date.now() / 1000;
    return payload.exp > now;
  } catch {
    // Fallback: sjekk bare at token eksisterer
    return token.length > 0;
  }
}

/**
 * Stopper reconnect forsøk og renser opp
 */
function stopReconnectAttempts(): void {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  currentReconnectAttempts = 0;
}

/**
 * Håndterer logout/auth-feil
 */
function handleAuthError(): void {
  console.log('🚫 Authentication failed - stopping SignalR reconnection');
  isManuallyDisconnected = true;
  stopReconnectAttempts();
  
  if (chatConnection) {
    chatConnection.stop().catch(err => 
      console.error('Error stopping SignalR connection:', err)
    );
  }
}

/**
 * Custom reconnect logikk med timeout og auth-sjekk
 */
function attemptReconnect(): void {
  if (isManuallyDisconnected || !hasValidToken()) {
    console.log('⚠️ Skipping reconnect - manually disconnected or invalid token');
    return;
  }

  if (currentReconnectAttempts >= maxReconnectAttempts) {
    console.log('❌ Max reconnect attempts reached, giving up');
    return;
  }

  currentReconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, currentReconnectAttempts - 1), 30000);
  
  console.log(`🔄 SignalR reconnect attempt ${currentReconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
  
  reconnectTimeoutId = setTimeout(async () => {
    if (!hasValidToken()) {
      handleAuthError();
      return;
    }

    try {
      if (chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        await chatConnection.start();
        console.log('✅ SignalR reconnected successfully');
        currentReconnectAttempts = 0; // Reset counter on success
      }
    } catch (error) {
      console.error(`❌ SignalR reconnect attempt ${currentReconnectAttempts} failed:`, error);
      
      // Sjekk for auth-feil
      if (error instanceof Error && 
          (error.message?.includes('401') || error.message?.includes('Unauthorized'))) {
        handleAuthError();
        return;
      }
      
      // Prøv igjen hvis vi ikke har nådd max forsøk
      if (currentReconnectAttempts < maxReconnectAttempts) {
        attemptReconnect();
      }
    }
  }, delay);
}

/**
 * Returnerer én delt tilkobling. Lager ny kun hvis ingen eksisterer.
 */
export function createChatConnection(): signalR.HubConnection {
  if (!chatConnection) {
    const deviceId = generateDeviceId();
    const platform = getPlatform();
    const capabilities = getCapabilities();
    
    // Bygg URL med query parameters
    const hubUrl = `${API_BASE_URL}${API_ROUTES.chatHub}?deviceId=${encodeURIComponent(deviceId)}&platform=${encodeURIComponent(platform)}&capabilities=${encodeURIComponent(capabilities.join(','))}`;
    
    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => {
          const token = getCurrentToken();
          if (!token || !hasValidToken()) {
            console.log('⚠️ No valid token available for SignalR');
            return "";
          }
          return token;
        },
        transport: signalR.HttpTransportType.WebSockets,
      })
      .configureLogging(signalR.LogLevel.Warning)
      // Fjern automatisk reconnect da vi håndterer det manuelt
      .build();

    // Håndter connection events
    chatConnection.onclose((error) => {
      console.log('🔌 SignalR connection closed', error);
      
      if (isManuallyDisconnected) {
        console.log('📱 Connection was manually closed, not reconnecting');
        return;
      }
      
      // Sjekk for auth-feil
      if (error instanceof Error && 
          (error.message?.includes('401') || error.message?.includes('Unauthorized'))) {
        handleAuthError();
        return;
      }
      
      // Start reconnect prosess
      attemptReconnect();
    });

    chatConnection.onreconnecting((error) => {
      console.log('🔄 SignalR attempting to reconnect...', error);
    });

    chatConnection.onreconnected((connectionId) => {
      console.log('✅ SignalR reconnected with connection ID:', connectionId);
      currentReconnectAttempts = 0;
    });

    // Event listeners for online/offline
    window.addEventListener('online', () => {
      console.log('🌐 Browser came online');
      if (!isManuallyDisconnected && hasValidToken() && 
          chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        attemptReconnect();
      }
    });

    window.addEventListener('offline', () => {
      console.log('📵 Browser went offline');
      stopReconnectAttempts();
    });

    // Cleanup ved beforeunload
    window.addEventListener('beforeunload', () => {
      isManuallyDisconnected = true;
      stopReconnectAttempts();
    });
  }
  
  isManuallyDisconnected = false; // Reset når vi lager ny connection
  return chatConnection;
}

/**
 * Returnerer eksisterende tilkobling uten å opprette ny.
 */
export function getChatConnection(): signalR.HubConnection | null {
  return chatConnection;
}

/**
 * Start connection med error handling
 */
export async function startChatConnection(): Promise<void> {
  const connection = createChatConnection();
  
  if (connection.state === signalR.HubConnectionState.Connected) {
    console.log('✅ SignalR already connected');
    return;
  }

  if (!hasValidToken()) {
    console.log('⚠️ No valid token, cannot start SignalR connection');
    return;
  }

  try {
    await connection.start();
    console.log('✅ SignalR connection started successfully');
    currentReconnectAttempts = 0;
  } catch (error) {
    console.error('❌ SignalR Connection Error:', error);
    
    if (error instanceof Error && 
        (error.message?.includes('401') || error.message?.includes('Unauthorized'))) {
      handleAuthError();
    } else {
      // Start reconnect prosess for andre feil
      attemptReconnect();
    }
    
    throw error;
  }
}

/**
 * Stopp connection manuelt (f.eks. ved logout)
 */
export async function stopChatConnection(): Promise<void> {
  isManuallyDisconnected = true;
  stopReconnectAttempts();
  
  if (chatConnection && chatConnection.state === signalR.HubConnectionState.Connected) {
    try {
      await chatConnection.stop();
      console.log('✅ SignalR connection stopped');
    } catch (error) {
      console.error('❌ Error stopping SignalR connection:', error);
    }
  }
  
  chatConnection = null;
}

/**
 * Reset connection (f.eks. etter ny login)
 */
export async function resetChatConnection(): Promise<void> {
  await stopChatConnection();
  isManuallyDisconnected = false;
  currentReconnectAttempts = 0;
}