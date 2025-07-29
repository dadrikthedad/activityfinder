// SignalRClient.tsx - Med direkte useChatHub kall
"use client";

import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
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
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { LocalToastType } from "../toast/Toast";
import { getFriendInvitationById } from "@/services/friends/friendService";
import { getNotificationById } from "@/services/notifications/notificationService";
import { useChatHub } from "@/hooks/signalr/useChatHub"; 
import { preloadMessagesForConversation } from "@/functions/SignalR/PreloadMessagesForConversation";

export default function SignalRClient() {
    const { token, userId } = useAuth();
    
    // Chat Store
    const addMessage = useChatStore((state) => state.addMessage);
    const updateConversationTimestamp = useChatStore((state) => state.updateConversationTimestamp);
    const updateMessageReactions = useChatStore((state) => state.updateMessageReactions);
    const updateSearchResultReactions = useChatStore((state) => state.updateSearchResultReactions);
    const searchMode = useChatStore((state) => state.searchMode);
    const addConversation = useChatStore(s => s.addConversation);
    const setCachedMessages = useChatStore(s => s.setCachedMessages);
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const showMessages = useChatStore.getState().showMessages;
    const removeConversation = useChatStore((state) => state.removeConversation);
    const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
    const removePendingRequest = useChatStore((state) => state.removePendingRequest);
    const updateMessage = useChatStore((state) => state.updateMessage);

    // Notification Store
    const addNotification = useNotificationStore((s) => s.addNotification);
    const addFriendRequest = useNotificationStore((s) => s.addFriendRequest);
    const notificationsRef = useNotificationStore((s) => s.notifications);
    const setFriendRequestTotalCount = useNotificationStore((s) => s.setFriendRequestTotalCount);
    const friendRequestTotalCount = useNotificationStore((s) => s.friendRequestTotalCount);

    // Message Notification Store
    const updateNotificationsForRejectedConversation = useMessageNotificationStore(
      (state) => state.updateNotificationsForRejectedConversation
    );

    // Other hooks
    const { syncPendingConversation } = usePendingConversationSync();
    const { refreshConversation } = useConversationUpdate();
    const { checkAndExecute } = useSimpleBootstrapCheck();

    // Helper functions (same as before)
    const ensureConversationExists = async (conversationId: number, shouldCacheMessages = true) => {
      const { conversationIds, pendingMessageRequests, cachedMessages } = useChatStore.getState();

      if (conversationIds.has(conversationId)) {
        if (shouldCacheMessages && !cachedMessages[conversationId]) {
          console.log(`💾 Proaktiv caching av meldinger for samtale ${conversationId}...`);
          try {
            const messages = await getMessagesForConversation(conversationId, 0, 50);
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

      const isPending = pendingMessageRequests.some(
        (request) => request.conversationId === conversationId
      );

      if (isPending) {
        console.log(`⏳ Samtale ${conversationId} er allerede i pending-listen, hopper over henting`);
        return;
      }

      console.log(`🔍 Samtale ${conversationId} finnes ikke i listen, henter den...`);

      try {
        const [conversation, messages] = await Promise.all([
          getConversationById(conversationId),
          shouldCacheMessages ? getMessagesForConversation(conversationId, 0, 50) : Promise.resolve(null)
        ]);

        if (conversation) {
          addConversation(conversation);
          console.log(`✅ Samtale ${conversationId} lagt til i listen`);

          if (messages && messages.length > 0 && shouldCacheMessages) {
            setCachedMessages(conversationId, messages);
            console.log(`✅ Cachet ${messages.length} meldinger for samtale ${conversationId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Kunne ikke hente samtale ${conversationId}:`, error);
      }
    };

    

    // 🚀 DIREKTE KALL til useChatHub - ikke via useSignalRService
    useChatHub(
      // onMessage
      async (message: MessageDTO) => {
        console.log("💬 Mottatt melding via useChatHub:", message);

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
          !message.isSystemMessage
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

      // onReaction  
      async (reaction, notification) => {
        console.log("🎉 Mottatt reaksjon via useChatHub:", reaction);

        if (notification?.conversationId) {
          await preloadMessagesForConversation(notification.conversationId);
        }

        updateMessageReactions(reaction as ReactionDTO);
        handleIncomingReaction(reaction, userId, notification);

        if (searchMode) {
          updateSearchResultReactions(reaction as ReactionDTO);
        }
      },

      // onRequestApproved
      async (notification) => {
        console.log("✅ Godkjent forespørsel via useChatHub:", notification); 
        const convId = notification.conversationId;
        if (!convId) return;

        showNotificationToast({
          senderName: notification.senderName ?? "Someone",
          messagePreview: notification.messagePreview,
          conversationId: convId,
          type: NotificationType.MessageRequestApproved,
        });

        await finalizeConversationApproval(convId, true, notification);
      },

      // onRequestCreated
      async (data: MessageRequestCreatedDto) => {
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

      // onGroupRequestCreated
      async (data: GroupRequestCreatedDto) => {
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

      // onGroupNotificationUpdated
      async (data: GroupNotificationUpdateDTO) => {
        console.log("🔔 GroupNotification oppdatert i SignalRClient:", data);
        const { userId: targetUserId, notification, groupEventType, affectedUsers } = data;
      
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

          let eventTypeEnum: GroupEventType;
          if (typeof groupEventType === 'string') {
            eventTypeEnum = GroupEventType[groupEventType as keyof typeof GroupEventType];
          } else {
            eventTypeEnum = groupEventType;
          }

          if (notification.conversationId != null) {
            await refreshConversation(notification.conversationId, {
              logPrefix: "👥"
            });
          }

          await handleIncomingNotification(enhancedNotification);

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

      // onGroupDisbanded
      async (data: GroupDisbandedDto) => {
        console.log("💥 Gruppe disbanded via useChatHub:", data);
        const { conversationId, groupName, notification } = data;
        
        removeConversation(conversationId);
        removePendingRequest(conversationId); 
        
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
        }

        updateNotificationsForRejectedConversation(conversationId);
        
        if (notification) {
          await handleIncomingNotification(notification);
          
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

      // onGroupParticipantsUpdated
      async (conversationId: number) => {
        console.log("🔁 Group participants updated via useChatHub for conversation:", conversationId);
        await syncPendingConversation(conversationId, true);
      },

      // onMessageDeleted
      async (data: { conversationId: number; message: MessageDTO }) => {
        console.log("🗑️ Mottatt slettet melding via useChatHub:", data);
        
        const { conversationId, message } = data;
        const { conversationIds } = useChatStore.getState();
        
        if (conversationIds.has(conversationId)) {
          console.log(`✅ Oppdaterer slettet melding ${message.id} i samtale ${conversationId}`);
          updateMessage(conversationId, message.id, message);
          console.log(`🔄 Melding ${message.id} oppdatert med isDeleted: ${message.isDeleted}`);
        } else {
          console.log(`⚠️ Samtale ${conversationId} finnes ikke i store, hopper over oppdatering`);
        }
      },

      // onNotification
      async (evt: NotificationDTO) => {
        console.log("🔔 Notification received via useChatHub:", evt);
        
        try {
          if (evt.type === "FriendInvitation") {
            if (!token || !evt.friendInvitationId) return;
            const fr = await getFriendInvitationById(evt.friendInvitationId, token);
            addNotification(evt);
            if (fr) {
              addFriendRequest(fr);
              setFriendRequestTotalCount(friendRequestTotalCount + 1);
              showNotificationToast({
                senderName: fr.userSummary?.fullName ?? "Someone",
                conversationId: -1,
                type: LocalToastType.FriendRequestReceived,
              });
            }
            return;
          }

          if (evt.type === "FriendInvAccepted") {
            addNotification(evt);

            if (evt.relatedUser) {
              showNotificationToast({
                senderName: evt.relatedUser.fullName ?? "Someone",
                type: LocalToastType.FriendInvAccepted,
                relatedUser: evt.relatedUser,
              });
            }

            if (evt.conversationId) {
              await finalizeConversationApproval(evt.conversationId);
            }
            return;
          }

          if (evt.message || evt.relatedUser) {
            addNotification(evt);
            return;
          }

          const cached = notificationsRef.find((n) => n.id === evt.id);
          if (cached) {
            addNotification(cached);
            return;
          }

          if (!token) return;
          const full = await getNotificationById(evt.id, token);
          if (full) addNotification(full);

        } catch (err) {
          console.error("❌ Realtime-handler feilet:", err);
        }
      }
    );

    return null; // Kun sideeffekter
}