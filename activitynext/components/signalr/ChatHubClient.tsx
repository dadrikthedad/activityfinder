// ChatHubClienten som brukes i layout til å koble seg på klienten og fanger meldinger som kommer over signalr
"use client";

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
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";
import { GroupRequestCreatedDto } from "@/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO, GroupEventType } from "@/types/GroupNotificationUpdateDTO";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { GroupDisbandedDto } from "@/types/GroupDisbandedDTO";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useConversationUpdate } from "@/hooks/common/useConversationUpdate";
import { MessageDTO } from "@/types/MessageDTO";
import { useSimpleBootstrapCheck } from "./useSimpleBootstrapCheck";
import { useSignalRService } from "./SignalRService";
import { NotificationHubClient } from "./NotificationHubClient";

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
    const setCachedMessages = useChatStore(s => s.setCachedMessages); // For å cache meldinger
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const { syncPendingConversation } = usePendingConversationSync();
    const showMessages = useChatStore.getState().showMessages;
    const removeConversation = useChatStore((state) => state.removeConversation);
    const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
    const removePendingRequest = useChatStore((state) => state.removePendingRequest);
    const updateNotificationsForRejectedConversation = useMessageNotificationStore(
      (state) => state.updateNotificationsForRejectedConversation
    );
    const { refreshConversation } = useConversationUpdate();
    const updateMessage = useChatStore((state) => state.updateMessage);
    // Sjekker at bootstrappen er ferdig før vi legger inn nye pending
    const { checkAndExecute } = useSimpleBootstrapCheck();

    NotificationHubClient();

    const ensureConversationExists = async (conversationId: number, shouldCacheMessages = true) => {
      const { conversationIds, pendingMessageRequests, cachedMessages } = useChatStore.getState();

      // Sjekk om samtalen allerede finnes
      if (conversationIds.has(conversationId)) {
        // Proaktiv caching av meldinger hvis vi ikke har dem allerede
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

          // Cache meldinger hvis vi fikk dem
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

    useSignalRService({
      // Melding
      onMessage: async (message) => {
        console.log("💬 Mottatt melding via SignalR:", message);

        // Sørg for at samtalen finnes og cache meldinger proaktivt
        await ensureConversationExists(message.conversationId, true);
   
        addMessage(message);
        updateConversationTimestamp(message.conversationId, message.sentAt);
        
        if (!message.isSilent && !message.isSystemMessage) {
          handleIncomingMessage(message, userId ?? null);
        }

        const { conversations } = useChatStore.getState();
        const conversation = conversations.find(c => c.id === message.conversationId);

        if (
          message.senderId !== userId &&
          (!showMessages || message.conversationId !== currentConversationId) && 
          !message.isSilent &&
          !message.isSystemMessage // Ingen toast for systemmeldinger
        ) {
          showNotificationToast({
            senderName: message.sender?.fullName ?? "ukjent",
            messagePreview: truncateText(message.text),
            senderProfileImage: message.sender?.profileImageUrl,
            conversationId: message.conversationId,
            type: NotificationType.NewMessage,
            attachments: message.attachments,
            groupName: conversation?.isGroup ? conversation?.groupName : null,
            groupImage: conversation?.isGroup ? conversation?.groupImageUrl : null,
          });
        }
      },

      // Reaksjon
      onReaction: async (reaction, notification) => {
        console.log("🎉 Mottatt reaksjon via SignalR:", reaction);
        console.log("🔔 Mottatt notification via SignalR:", notification);

        // Preload meldinger for reakcsjonssamtalen
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
      onRequestApproved: async (notification) => {
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
      onRequestCreated: async (data: MessageRequestCreatedDto) => {
        await checkAndExecute(async () => {
          if (data.notification) {
            await handleIncomingNotification(data.notification);
            await syncPendingConversation(data.conversationId);
            
            if (data.notification.senderId !== userId) {
              showNotificationToast({
                senderName: data.notification.senderName,
                messagePreview: data.notification.messagePreview,
                type: NotificationType.MessageRequest,
                conversationId: data.conversationId,
              });
            }
          }
        });
      },

      // Gruppeforespørsel opprettet - handle exactly like MessageRequest
      onGroupRequestCreated: async (data: GroupRequestCreatedDto) => {
        await checkAndExecute(async () => {
          if (data.notification) {
            await handleIncomingNotification(data.notification);
            await syncPendingConversation(data.conversationId);
            
            if (data.notification.senderId !== userId) {
              showNotificationToast({
                messagePreview: data.notification.messagePreview,
                type: NotificationType.GroupRequest,
                conversationId: data.conversationId,
                groupName: data.groupName,
                groupImage: data.notification.groupImageUrl,
                senderName: data.notification.senderName || "Someone",
                senderProfileImage: data.notification.senderProfileImageUrl || "/default-avatar.png"
              });
            }
          }
        });
      },

      // Ny GroupNotificationUpdated callback
      onGroupNotificationUpdated: async (data: GroupNotificationUpdateDTO) => {
        console.log("🔔 GroupNotification oppdatert i ChatHubClient:", data);
        const { userId: targetUserId, notification, groupEventType, affectedUsers } = data;
      
        // Sjekk at notifikasjonen er for den innloggede brukeren
        if (targetUserId !== userId) {
          console.log("⚠️ GroupNotification ikke for denne brukeren, hopper over");
          return;
        }
      
        if (notification) {
          const enhancedNotification: MessageNotificationDTO = {
            ...notification,
            latestGroupEventType: typeof groupEventType === 'string' ? groupEventType : String(groupEventType),
            latestAffectedUsers: affectedUsers
          };

          // Konverter string til enum verdi
          let eventTypeEnum: GroupEventType;

          // Håndter både string og nummer fra backend
          if (typeof groupEventType === 'string') {
            eventTypeEnum = GroupEventType[groupEventType as keyof typeof GroupEventType];
          } else {
            eventTypeEnum = groupEventType;
          }

          // 🆕 Håndter forskjellige group events
          if (notification.conversationId != null) {
            await refreshConversation(notification.conversationId, {
              logPrefix: "👥" // Samme prefix for alle group events
            });
          }

          // Oppdater notification-panelet med enhanced data
          await handleIncomingNotification(enhancedNotification);

          // Vis toast for alle hendelser
          if (notification.conversationId != null) {
            showNotificationToast({
              senderName: notification.senderName ?? "Someone",
              type: NotificationType.GroupEvent,
              conversationId: notification.conversationId,
              groupName: notification.groupName,
              groupImage: notification.groupImageUrl,
              groupEventType: eventTypeEnum,
              affectedUsers: affectedUsers,
            });
          }
        }
      },

      onGroupDisbanded: async (data: GroupDisbandedDto) => {
        console.log("💥 Gruppe disbanded via SignalR:", data);
        const { conversationId, groupName, notification } = data;
        
        // Fjern samtalen fra store
        removeConversation(conversationId);
        removePendingRequest(conversationId); 
        
        // Hvis brukeren er i den disbanded samtalen, naviger bort
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
        }

        updateNotificationsForRejectedConversation(conversationId);
        
        // Oppdater notification hvis den finnes
        if (notification) {
          await handleIncomingNotification(notification);
          
          // Vis toast om disbanded gruppe
          showNotificationToast({
            senderName: "System",
            messagePreview: `Group "${groupName}" has been disbanded`,
            type: NotificationType.GroupDisbanded,
            conversationId,
            groupName: groupName,
          });
        }
        
        console.log(`✅ Fjernet disbanded gruppe ${conversationId} fra store`);
      },

      // Oppdaterer en gruppeforespørsel med riktig participants ved nylig inviterte brukere
      onGroupParticipantsUpdated: async (conversationId: number) => {
        console.log("🔁 Group participants updated via SignalR for conversation:", conversationId);
        
        // Bruk med forceUpdate for å oppdatere participants
        await syncPendingConversation(conversationId, true);
      },

      onMessageDeleted: async (data: { conversationId: number; message: MessageDTO }) => {
        console.log("🗑️ Mottatt slettet melding via SignalR:", data);
        
        const { conversationId, message } = data;
        const { conversationIds } = useChatStore.getState();
        
        // Sjekk om vi har denne samtalen i store
        if (conversationIds.has(conversationId)) {
          console.log(`✅ Oppdaterer slettet melding ${message.id} i samtale ${conversationId}`);
          updateMessage(conversationId, message.id, message);
          console.log(`🔄 Melding ${message.id} oppdatert med isDeleted: ${message.isDeleted}`);
        } else {
          console.log(`⚠️ Samtale ${conversationId} finnes ikke i store, hopper over oppdatering`);
        }
      }
    });

    return null; // Kun sideeffekter
}