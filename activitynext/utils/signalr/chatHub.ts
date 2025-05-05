// utils/signalr/chatHub.ts
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

let chatConnection: signalR.HubConnection | null = null;

/**
 * Returnerer én delt tilkobling. Lager ny kun hvis ingen eksisterer.
 */
export function createChatConnection(): signalR.HubConnection {
  if (!chatConnection) {
    chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}${API_ROUTES.chatHub}`, {
        accessTokenFactory: () => localStorage.getItem("token") ?? "",
        transport: signalR.HttpTransportType.WebSockets,
      })
      .configureLogging(signalR.LogLevel.Warning) // Mindre støy
      .withAutomaticReconnect()
      .build();
  }

  return chatConnection;
}

/**
 * Returnerer eksisterende tilkobling uten å opprette ny.
 */
export function getChatConnection(): signalR.HubConnection | null {
  return chatConnection;
}