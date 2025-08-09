// utils/signalr/chatHub.ts
import * as signalR from "@microsoft/signalr";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from "@/constants/routes";
import { API_ROUTES } from "@shared/constants/routes";
import { generateDeviceId, getPlatform, getCapabilities } from "../device/UserOnlineFunctions";


let chatConnection: signalR.HubConnection | null = null;
let networkUnsubscribe: (() => void) | null = null;

/**
 * Returnerer én delt tilkobling. Lager ny kun hvis ingen eksisterer.
 */
export async function createChatConnection(): Promise<signalR.HubConnection> {
  if (!chatConnection) {
    const deviceId = await generateDeviceId(); // 🔧 Legg til await
    const platform = getPlatform();
    const capabilities = getCapabilities();
    
    // Bygg URL med query parameters
    const hubUrl = `${API_BASE_URL}${API_ROUTES.chatHub}?deviceId=${encodeURIComponent(deviceId)}&platform=${encodeURIComponent(platform)}&capabilities=${encodeURIComponent(capabilities.join(','))}`;
    
    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const token = await AsyncStorage.getItem("token");
          return token ?? "";
        },
        transport: signalR.HttpTransportType.WebSockets,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          console.log(`🔄 SignalR reconnect attempt ${retryContext.previousRetryCount + 1}`);
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .build();

    // Setup network state listeners
    networkUnsubscribe = NetInfo.addEventListener(state => {
      console.log('📱 SignalR - Network state changed:', state.isConnected);
      
      if (state.isConnected && chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        console.log('🌐 SignalR - Device came online');
        chatConnection.start().catch(err => console.error('Failed to restart SignalR:', err));
      } else if (!state.isConnected) {
        console.log('📵SignalR - Device went offline');
      }
    });
  }
 
  return chatConnection;
}

/**
 * Returnerer eksisterende tilkobling uten å opprette ny.
 */
export function getChatConnection(): signalR.HubConnection | null {
  return chatConnection;
}

/**
 * Stopper tilkoblingen og rydder opp ressurser
 */
export async function stopChatConnection(): Promise<void> {
  if (chatConnection) {
    try {
      await chatConnection.stop();
    } catch (error) {
      console.error('SignalR - Error stopping SignalR connection:', error);
    }
    chatConnection = null;
  }
  
  // Cleanup network listener
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
}