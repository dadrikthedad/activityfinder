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
import { getMessagesForConversation } from "@/services/messages/conversationService"; // 🆕 Bruk din eksisterende service
import { useStore } from "zustand";
import { usePendingConversationSync } from "@/hooks/messages/getPendingConversationById";
import { NotificationType } from "@/types/MessageNotificationDTO";
import truncateText from "@/services/helpfunctions/truncateMsgTextForToast";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";
import { GroupRequestCreatedDto } from "@/types/GroupRequestDTO";
import { GroupMemberInvitedDto } from "@/types/GroupMemberInvitedDTO";
import { updateConversationParticipants } from "@/services/helpfunctions/conversationUpdateSerivce";

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
    const setCachedMessages = useChatStore(s => s.setCachedMessages); // 🆕 For å cache meldinger
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const { syncPendingConversation } = usePendingConversationSync();
    const showMessages = useChatStore.getState().showMessages;

    const ensureConversationExists = async (conversationId: number, shouldCacheMessages = true) => {
      const { conversationIds, pendingMessageRequests, cachedMessages } = useChatStore.getState();

      // Sjekk om samtalen allerede finnes
      if (conversationIds.has(conversationId)) {
        // 🆕 Proaktiv caching av meldinger hvis vi ikke har dem allerede
        if (shouldCacheMessages && !cachedMessages[conversationId]) {
          console.log(`💾 Proaktiv caching av meldinger for samtale ${conversationId}...`);
          try {
            const messages = await getMessagesForConversation(conversationId, 0, 50); // Hent siste 50 meldinger
            if (messages && messages.length > 0) {
              setCachedMessages(conversationId, messages);
              console.log(`✅ Cachet ${messages.length} meldinger for samtale ${conversationId}`);
            }
          } catch (error) {
            console.error(`❌ Kunne ikke cache meldinger for samtale ${conversationId}:`, error);
          }
        }
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
        // Hent både samtale og meldinger parallelt
        const [conversation, messages] = await Promise.all([
          getConversationById(conversationId),
          shouldCacheMessages ? getMessagesForConversation(conversationId, 0, 50) : Promise.resolve(null)
        ]);

        if (conversation) {
          addConversation(conversation);
          console.log(`✅ Samtale ${conversationId} lagt til i listen`);

          // 🆕 Cache meldinger hvis vi fikk dem
          if (messages && messages.length > 0 && shouldCacheMessages) {
            setCachedMessages(conversationId, messages);
            console.log(`✅ Cachet ${messages.length} meldinger for samtale ${conversationId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Kunne ikke hente samtale ${conversationId}:`, error);
      }
    };

    // Utvidet funksjon for å cache meldinger for eksisterende samtaler
    const preloadMessagesForConversation = async (conversationId: number) => {
      const { cachedMessages, conversationIds } = useChatStore.getState();
      
      // Kun cache hvis samtalen finnes og vi ikke allerede har cachet meldinger
      if (conversationIds.has(conversationId) && !cachedMessages[conversationId]) {
        console.log(`🚀 Preloader meldinger for samtale ${conversationId}...`);
        try {
          const messages = await getMessagesForConversation(conversationId, 0, 50);
          if (messages && messages.length > 0) {
            setCachedMessages(conversationId, messages);
            console.log(`✅ Preloadet ${messages.length} meldinger for samtale ${conversationId}`);
          }
        } catch (error) {
          console.error(`❌ Kunne ikke preloade meldinger for samtale ${conversationId}:`, error);
        }
      }
    };

    
    
    // Kjør useChatHub direkte – hooken sørger selv for å starte og stoppe
    // Melding
    useChatHub(async (message) => {
      console.log("💬 Mottatt melding via SignalR:", message);

      // 🆕 Sørg for at samtalen finnes og cache meldinger proaktivt
      await ensureConversationExists(message.conversationId, true);
 
      addMessage(message);
      updateConversationTimestamp(message.conversationId, message.sentAt);
      
      if (!message.isSilent) {
        handleIncomingMessage(message, userId ?? null);
      }

      if (
        message.senderId !== userId &&
        (!showMessages || message.conversationId !== currentConversationId) && !message.isSilent
      ) {
        showNotificationToast({
          senderName: message.sender?.fullName ?? "ukjent",
          messagePreview: truncateText(message.text ?? "Du har fått en melding"),
          senderProfileImage: message.sender?.profileImageUrl,
          conversationId: message.conversationId,
          type: NotificationType.NewMessage,
        });
      }
    },

    // reaksjon
    async (reaction, notification) => {
      console.log("🎉 Mottatt reaksjon via SignalR:", reaction);
      console.log("🔔 Mottatt notification via SignalR:", notification);

      // 🆕 Preload meldinger for reakcsjonssamtalen
      if (notification?.conversationId) {
        await preloadMessagesForConversation(notification.conversationId);
      }

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

          // 🔄 Hent og legg til pending-samtale (uten å cache meldinger for pending)
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
      },
       // Gruppeforespørsel opprettet - handle exactly like MessageRequest
      async ({ senderId, receiverId, conversationId, groupName, notification }: GroupRequestCreatedDto) => {
        if (!conversationId) {
          console.error("🚨 Mangler conversationId i gruppe signalr-data:", {
            senderId,
            receiverId,
            conversationId,
            groupName,
          });
          return;
        }

        console.log("👥 Gruppeforespørsel opprettet via SignalR:", {
          senderId,
          receiverId,
          conversationId,
          groupName,
          notification,
        });

        if (notification) {
          // 🔔 Oppdater notification-panelet i sanntid
          await handleIncomingNotification(notification);

          // 🔄 Hent og legg til pending-samtale (uten å cache meldinger for pending)
          await syncPendingConversation(conversationId);

          // Only show toast if it's not from the current user
          if (notification.senderId !== userId) {
            showNotificationToast({
              messagePreview: notification.messagePreview,
              type: NotificationType.GroupRequest,
              conversationId,
              groupName: groupName,
              groupImage: notification.groupImageUrl,
              senderName: notification.senderName || "Someone",
              senderProfileImage: notification.senderProfileImageUrl || "/default-avatar.png" // Sett default her
            });
          }
          
        }
      },

      // GroupRequestApproved
      async (notification) => {
        console.log("✅ Godkjent gruppeforespørsel via SignalR:", notification); 
        const convId = notification.conversationId;
        if (!convId) {
          return;
        }

        if (notification.senderId) {
          await updateConversationParticipants(convId, "User approved group request");
        }

        showNotificationToast({
          senderName: notification.senderName ?? "Someone",
          messagePreview: notification.messagePreview,
          conversationId: convId,
          type: NotificationType.GroupRequestApproved, // Antar at du har denne typen
          groupName: notification.groupName,
          groupImage: notification.groupImageUrl,
        });

        // await finalizeConversationApproval(convId, true, notification);
      },

       async (data: GroupMemberInvitedDto) => {
        console.log("➕ Gruppemedlem invitert i ChatHubClient:", data);
        const { notification, inviterName, conversationId, isSilent } = data;
        
        // Oppdater participants når noen blir invitert
        await updateConversationParticipants(conversationId, "New members invited to group");
        
        if (notification) {
          // 🔔 Oppdater notification-panelet i sanntid
          await handleIncomingNotification(notification);
          
          // 🔕 Vis kun toast hvis ikke silent
          if (!isSilent) {
            showNotificationToast({
              senderName: inviterName,
              messagePreview: notification.messagePreview, // Bruker preview fra backend
              type: NotificationType.GroupRequestInvited,
              conversationId,
              groupName: notification.groupName,
              groupImage: notification.groupImageUrl,
            });
          }
        }
      }



  );

  return null; // Kun sideeffekter
}