// utils/signalr/chatHub.ts
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";
import { generateDeviceId } from "@/functions/bootstrap/UserOnlineFunctions";
import { getPlatform } from "@/functions/bootstrap/UserOnlineFunctions";
import { getCapabilities } from "@/functions/bootstrap/UserOnlineFunctions";

let chatConnection: signalR.HubConnection | null = null;

/**
 * Returnerer én delt tilkobling. Lager ny kun hvis ingen eksisterer.
 */
export function createChatConnection(): signalR.HubConnection {
  if (!chatConnection) {
    const deviceId = generateDeviceId(); // 🆕 Gjenbruk eksisterende
    const platform = getPlatform(); // 🆕 Gjenbruk eksisterende
    const capabilities = getCapabilities();

    // Bygg URL med query parameters
    const hubUrl = `${API_BASE_URL}${API_ROUTES.chatHub}?deviceId=${encodeURIComponent(deviceId)}&platform=${encodeURIComponent(platform)}&capabilities=${encodeURIComponent(capabilities.join(','))}`;

    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem("token") ?? "",
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

    // Event listeners for online/offline
    window.addEventListener('online', () => {
      console.log('🌐 Browser came online');
      if (chatConnection?.state === signalR.HubConnectionState.Disconnected) {
        chatConnection.start().catch(err => console.error('Failed to restart SignalR:', err));
      }
    });

    window.addEventListener('offline', () => {
      console.log('📵 Browser went offline');
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