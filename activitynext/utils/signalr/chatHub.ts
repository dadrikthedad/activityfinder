// Her er chatHuben som er koblet opp mot backend sin, og med token så blir vi autenticated.
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

let chatConnection: signalR.HubConnection | null = null;

export function createChatConnection(): signalR.HubConnection {
  if (chatConnection) return chatConnection;

  chatConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}${API_ROUTES.chatHub}`, {
      accessTokenFactory: () => localStorage.getItem("token") ?? "",
      transport: signalR.HttpTransportType.WebSockets
    })
    .configureLogging(signalR.LogLevel.Information)
    .withAutomaticReconnect()
    .build();

  return chatConnection;
}

export function getChatConnection(): signalR.HubConnection | null {
  return chatConnection;
}
