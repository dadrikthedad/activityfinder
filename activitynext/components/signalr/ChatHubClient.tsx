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
import { handleIncomingNotification } from "@/services/helpfunctions/getNotificationsBeforeSignalr";
import { getConversationById } from "@/services/messages/conversationService";
import { useStore } from "zustand";
import { usePendingConversationSync } from "@/hooks/messages/getPendingConversationById";
import { NotificationType } from "@/types/MessageNotificationDTO";
import truncateText from "@/services/helpfunctions/truncateMsgTextForToast";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";

export default function ChatHubClient() {
    const addMessage = useChatStore((state) => state.addMessage);
    const updateConversationTimestamp = useChatStore( // For å oppdatere samtalelisten i sanntid ved ny melding
      (state) => state.updateConversationTimestamp
    );
    const updateMessageReactions = useChatStore((state) => state.updateMessageReactions); // Oppdaterer meldingsreaksjoner
    const updateSearchResultReactions = useChatStore((state) => state.updateSearchResultReactions); // Oppdater reaksjoner i søkefelt
    const searchMode = useChatStore((state) => state.searchMode);
    const { userId } = useAuth();
    const addConversation = useChatStore(s => s.addConversation);
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const { syncPendingConversation } = usePendingConversationSync();
    const showMessages = useChatStore.getState().showMessages;

    const ensureConversationExists = async (conversationId: number) => {
      const { conversationIds, pendingMessageRequests } = useChatStore.getState();

      // Sjekk om samtalen allerede finnes
      if (conversationIds.has(conversationId)) {
        return;
      }

      // Sjekk om samtalen er i pending-listen
      const isPending = pendingMessageRequests.some(
        (request) => request.conversationId === conversationId
      );

      if (isPending) {
        console.log(`⏳ Samtale ${conversationId} er allerede i pending-listen, hopper over henting`);
        return;
      }

      console.log(`🔍 Samtale ${conversationId} finnes ikke i listen, henter den...`);

      try {
        const conversation = await getConversationById(conversationId);
        if (conversation) {
          addConversation(conversation);
          console.log(`✅ Samtale ${conversationId} lagt til i listen`);
        }
      } catch (error) {
        console.error(`❌ Kunne ikke hente samtale ${conversationId}:`, error);
      }
    };
    


  
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    // Melding
    useChatHub(async (message) => {
      console.log("💬 Mottatt melding via SignalR:", message);

      await ensureConversationExists(message.conversationId);
 
      addMessage(message);
      updateConversationTimestamp(message.conversationId, message.sentAt);
      handleIncomingMessage(message, userId ?? null);

      if (
        message.senderId !== userId &&
        (!showMessages || message.conversationId !== currentConversationId)
      ) {
        showNotificationToast({
          senderName: message.sender?.fullName ?? "ukjent",
          messagePreview: truncateText(message.text ?? "Du har fått en melding"),
          conversationId: message.conversationId,
          type: NotificationType.NewMessage,
        });
      }
    },

    // reaksjon
    (reaction, notification) => {
      console.log("🎉 Mottatt reaksjon via SignalR:", reaction);
      console.log("🔔 Mottatt notification via SignalR:", notification);

      updateMessageReactions(reaction as ReactionDTO); // Oppdater cache uansett
      handleIncomingReaction(reaction, userId, notification); // 👈 send med notification

      if (searchMode) {
        updateSearchResultReactions(reaction as ReactionDTO);
      }
    },


    // Godkjent forespørsel
    async (notification) => {
        console.log("✅ Godkjent forespørsel via SignalR:", notification); 
        const convId = notification.conversationId;
         if (!convId) {
          return;
        }

          showNotificationToast({
            senderName: notification.senderName ?? "Someone",
            messagePreview: notification.messagePreview,
            conversationId: convId,
            type: NotificationType.MessageRequestApproved,
          });

        await finalizeConversationApproval(convId, true, notification);
      },


      // Lagd en meldingsforespørsel til en annen bruker
      async ({ senderId, receiverId, conversationId, notification }: MessageRequestCreatedDto) => {
        if (!conversationId) {
          console.error("🚨 Mangler conversationId i signalr-data:", {
            senderId,
            receiverId,
            conversationId,
          });
          return;
        }

        console.log("📨 Forespørsel opprettet via SignalR:", {
          senderId,
          receiverId,
          conversationId,
          notification,
        });

        if (notification) {
          // 🔔 Oppdater notification-panelet i sanntid
          await handleIncomingNotification(notification);

          // 🔄 Hent og legg til pending-samtale
  
            await syncPendingConversation(conversationId);

          if (notification.senderId !== userId) {
            showNotificationToast({
              senderName: notification.senderName,
              messagePreview: notification.messagePreview,
              type: NotificationType.MessageRequest,
              conversationId,
            });
          }
        }
      }
  );

  return null; // Kun sideeffekter
  
}

    