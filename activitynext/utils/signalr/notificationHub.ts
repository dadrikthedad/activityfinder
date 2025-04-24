// Her oppretter vi en SingalR-tilkobling mot backendends NotificationHub. Ved at backend lager en notficaiton, feks en melding, så får frontenden beskjed om at en melding har kommet
import * as signalR from "@microsoft/signalr";
import { API_BASE_URL, API_ROUTES } from "@/constants/routes";

let connection: signalR.HubConnection | null = null;

export function createNotificationConnection(token: string): signalR.HubConnection {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}${API_ROUTES.notificationHub}`, {
        accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .build();

  return connection;
}