// ChatHubClienten som brukes i layout til å koble seg på klienten og fanger meldinger som kommer over signalr
"use client";

import { useChatHub } from "@/hooks/signalr/useChatHub";
import { useChatStore } from "@/store/useChatStore";
import { ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";
import { handleIncomingMessage } from "./handleIncomingMessage";
import { useAuth } from "@/context/AuthContext";
import { handleIncomingReaction } from "./handleIncomingReactions";
import { showNotificationToast } from "../toast/Toast";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";

export default function ChatHubClient() {
    const addMessage = useChatStore((state) => state.addMessage);
    const updateConversationTimestamp = useChatStore( // For å oppdatere samtalelisten i sanntid ved ny melding
      (state) => state.updateConversationTimestamp
    );
    const updateMessageReactions = useChatStore((state) => state.updateMessageReactions); // Oppdaterer meldingsreaksjoner
    const updateSearchResultReactions = useChatStore((state) => state.updateSearchResultReactions); // Oppdater reaksjoner i søkefelt
    const searchMode = useChatStore((state) => state.searchMode);
    const { userId } = useAuth();

  
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    useChatHub((message) => {
      console.log("💬 Mottatt melding via SignalR:", message);
      addMessage(message);
      updateConversationTimestamp(message.conversationId, message.sentAt);
      handleIncomingMessage(message, userId ?? null);

      if (message.senderId !== userId) {
        showNotificationToast({
          senderName: message.sender?.fullName ?? "ukjent",
          messagePreview: message.text ?? "Du har fått en melding",
          conversationId: message.conversationId,
      });

      }
    },
    (reaction, notification) => {
      console.log("🎉 Mottatt reaksjon via SignalR:", reaction);
      console.log("🔔 Mottatt notification via SignalR:", notification);

      updateMessageReactions(reaction as ReactionDTO); // Oppdater cache uansett
      handleIncomingReaction(reaction, userId, notification); // 👈 send med notification

      if (searchMode) {
        updateSearchResultReactions(reaction as ReactionDTO);
      }
    },
    (notification) => {
        console.log("✅ Godkjent forespørsel via SignalR:", notification); 
        // 🔔 Legg den direkte inn i notification-storen
        useMessageNotificationStore.getState().upsertNotification(notification);
         if (notification.senderId !== userId && notification.conversationId) {
            showNotificationToast({
              senderName: notification.senderName,
              messagePreview: notification.messagePreview,
              conversationId: notification.conversationId,
            });
          }
      },
      ({ senderId, receiverId, conversationId, notification }: MessageRequestCreatedDto) => {
        if (!conversationId) {
          console.error("🚨 Mangler conversationId i signalr-data:", { senderId, receiverId, conversationId });
          return;
        }

        console.log("📨 Forespørsel opprettet via SignalR:", {
          senderId,
          receiverId,
          conversationId,
          notification
        });

        // ✅ Oppdater notification-panelet i sanntid
         if (notification) {
        useMessageNotificationStore.getState().upsertNotification(notification);

        if (notification.senderId !== userId && conversationId) {
          showNotificationToast({
            senderName: notification.senderName,
            messagePreview: notification.messagePreview,
            conversationId,
          });
        }
      }
    }
  );

  return null; // Kun sideeffekter
}