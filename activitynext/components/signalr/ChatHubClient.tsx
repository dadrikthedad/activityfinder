// ChatHubClienten som brukes i layout til å koble seg på klienten og fanger meldinger som kommer over signalr
"use client";

import { useChatHub } from "@/hooks/signalr/useChatHub";
import { useChatStore } from "@/store/useChatStore";

export default function ChatHubClient() {
    const addMessage = useChatStore((state) => state.addMessage);
  
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    useChatHub((message) => {
      console.log("💬 Mottatt melding via SignalR:", message);
      addMessage(message);
    });
  
    return null; // Kun sideeffekt
  }