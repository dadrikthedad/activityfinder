"use client";
// Vi bruker hooken fra useNotificationHub som brukes for å aktivre samt holde SingalR-tilkoblingen levende i react. Brukes i layout.tsx
import { useRealtimeNotifications } from "./useRealtimeNotifications";

export default function NotificationHubClient() {
  useRealtimeNotifications();       // kobler SignalR → zustand
  return null;                      // rendrer ingenting i DOM
}