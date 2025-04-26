// En superlett hook for å brukes i layout for å spare kode og gjør det mer oversiktelig
"use client";

import { useChat } from "@/hooks/useChat";

export default function ChatHubClient() {
  useChat(); // Bare initialiserer chat-tilkoblingen
  return null;
}
