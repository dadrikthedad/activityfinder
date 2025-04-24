"use client";
// Vi bruker hooken fra useNotificationHub som brukes for å aktivre samt holde SingalR-tilkoblingen levende i react. Brukes i layout.tsx
import { useNotificationHub } from "@/hooks/useNotificationHub";

export default function NotificationHubClient() {
  useNotificationHub(); // Bruk hooken her
  return null; // Komponent rendres ikke, den bare kjører hooken
}
