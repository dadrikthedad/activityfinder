// ChatHubClienten som brukes i layout til å koble seg på klienten og fanger meldinger som kommer over signalr
"use client";

import { useChatHub } from "@/hooks/signalr/useChatHub";
import { useChatStore } from "@/store/useChatStore";
import { ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";

export default function ChatHubClient() {
    const addMessage = useChatStore((state) => state.addMessage);
    const updateConversationTimestamp = useChatStore( // For å oppdatere samtalelisten i sanntid ved ny melding
      (state) => state.updateConversationTimestamp
    );
    const updateMessageReactions = useChatStore((state) => state.updateMessageReactions); // Oppdaterer meldingsreaksjoner

  
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    useChatHub((message) => {
      console.log("💬 Mottatt melding via SignalR:", message);
      addMessage(message);
      updateConversationTimestamp(message.conversationId, message.sentAt);
    },
    (reaction) => {
        console.log("🎉 Mottatt reaksjon via SignalR:", reaction);
        updateMessageReactions(reaction as ReactionDTO); // 👈 NY
      },
    ({ ReceiverId, ConversationId }) => {
        console.log("✅ Godkjent forespørsel via SignalR:", ReceiverId, ConversationId); 
      },
    ({ senderId, receiverId, conversationId }: MessageRequestCreatedDto) => {
      if (!conversationId) {
        console.error("🚨 Mangler conversationId i signalr-data:", { senderId, receiverId, conversationId });
        return;
      }

      console.log("📨 Forespørsel opprettet via SignalR:", { senderId, receiverId, conversationId });
    }
    );
  
    return null; // Kun sideeffekt
  }