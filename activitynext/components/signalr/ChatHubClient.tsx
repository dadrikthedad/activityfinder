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
import { getMessagesForConversation } from "@/services/messages/conversationService";
import { useStore } from "zustand";
import { usePendingConversationSync } from "@/hooks/messages/getPendingConversationById";
import { NotificationType } from "@/types/MessageNotificationDTO";
import truncateText from "@/services/helpfunctions/truncateMsgTextForToast";
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
    const removeRequest = useChatStore(s => s.removePendingRequest);
    const addConversation = useChatStore(s => s.addConversation);
    const setCachedMessages = useChatStore(s => s.setCachedMessages);
    const setPendingLockedConversationId = useChatStore(s => s.setPendingLockedConversationId);
    const setCurrentConversationId = useChatStore(s => s.setCurrentConversationId);
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const { syncPendingConversation } = usePendingConversationSync();
    const currentId = useChatStore.getState().currentConversationId; // Sjekke om vi er i riktig samtale for å sende oss tilbake i samme samtale etter godkjenning


  
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    // Melding
    useChatHub((message) => {
      console.log("💬 Mottatt melding via SignalR:", message);
      addMessage(message);
      updateConversationTimestamp(message.conversationId, message.sentAt);
      handleIncomingMessage(message, userId ?? null);

      if (
        message.senderId !== userId &&
        message.conversationId !== currentConversationId
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

        // 1) Fjern request fra pending-lista
        removeRequest(convId);

        // 2) Hent full samtale‐metadata og legg inn i listene
        let conv = await getConversationById(convId);
          if (!conv) return;

        // 2.a) Sørg for at isPendingApproval blir false
        conv = { ...conv, isPendingApproval: false };

        // 2.b) push inn i store
        addConversation(conv);

        // 3) Hent de siste meldingene for cache
        const msgs = await getMessagesForConversation(convId, 0, 20);
        setCachedMessages(convId, msgs ?? []);

        // 4) “Lås opp” pending‐status og vis samtalen
        setPendingLockedConversationId(null);
        if (currentId === convId) {
          setCurrentConversationId(convId);
          useMessageNotificationStore.getState().markAsReadForConversation(convId);
        }
        else {
          // Marker som ulest hvis vi ikke åpner samtalen
          const state = useChatStore.getState();
          if (!state.unreadConversationIds.includes(convId)) {
            state.setUnreadConversationIds([...state.unreadConversationIds, convId]);
          }
        }

        // 5) Oppdater notification‐panelet
        // 🔔 Legg den direkte inn i notification-storen
        await handleIncomingNotification(notification);
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