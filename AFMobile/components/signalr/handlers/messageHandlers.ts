// messageHandlers.ts - Alle message-relaterte handlers (med riktige eksisterende types)
import { useChatStore } from "@/store/useChatStore";
import { MessageDTO, ReactionDTO } from "@shared/types/MessageDTO";
import { MessageRequestCreatedDto } from "@shared/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@shared/types/MessageNotificationDTO";
import { handleIncomingMessage } from "../handleIncomingMessage";
import { handleIncomingReaction } from "../handleIncomingReactions";
import { showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { handleIncomingNotification } from "@/utils/messages/getNotificationsBeforeSignalr";
import { NotificationType } from "@shared/types/MessageNotificationDTO";
import truncateText from "@shared/utils/text/truncateMsgTextForToast";
import { preloadMessagesForConversation } from "@/utils/messages/PreloadMessagesForConversation";
import { finalizeConversationApproval } from "@/hooks/messages/finalizeConversationApproval";

// Types for function parameters
type CheckAndExecuteFunction = (callback: () => Promise<void>) => Promise<void>;
type SyncPendingConversationFunction = (conversationId: number, forceRefresh?: boolean) => Promise<unknown>;

export const handleMessage = async (
  message: MessageDTO,
  userId: number | null,
  currentConversationId: number | null, // Dette kan være utdatert
  showMessages: boolean, // Dette kan være utdatert
  ensureConversationExists: (conversationId: number, shouldCache?: boolean) => Promise<void>,
) => {
  console.log("💬 Mottatt melding via useChatHub:", message);
  const {
    addMessage,
    registerOptimisticMapping,
    registerOptimisticAttachmentMapping,
    updateConversationTimestamp,
    conversations,
    liveMessages,
    // 🆕 Hent den faktiske tilstanden fra store
    currentConversationId: actualCurrentConversationId,
    isAtBottom
  } = useChatStore.getState();
 
  try {
    await ensureConversationExists(message.conversationId, true);
  } catch (error) {
    console.error(`❌ Klarte ikke sikre samtale ${message.conversationId}:`, error);
    return;
  }

  try {
    // 🔧 Sjekk om dette er en bekreftelse på en optimistisk melding
    const currentMessages = liveMessages[message.conversationId] || [];
    const optimisticMatch = currentMessages.find(m =>
      m.isOptimistic &&
      m.text === message.text &&
      m.senderId === message.senderId &&
      Math.abs(new Date(m.sentAt).getTime() - new Date(message.sentAt).getTime()) < 10000
    );

    if (optimisticMatch && optimisticMatch.optimisticId) {
      // 🎯 Registrer mapping for melding - INGEN visual endring
      registerOptimisticMapping(optimisticMatch.optimisticId, message.id);
      console.log(`🔗 Registered mapping: ${optimisticMatch.optimisticId} → ${message.id}`);
      
      // 🆕 Registrer mapping for vedlegg også
      if (optimisticMatch.attachments && message.attachments && message.attachments.length > 0) {
        message.attachments.forEach((serverAttachment, index) => {
          const optimisticAttachment = optimisticMatch.attachments[index];
          if (optimisticAttachment?.isOptimistic && optimisticAttachment.optimisticId) {
            registerOptimisticAttachmentMapping(
              optimisticAttachment.optimisticId,
              serverAttachment.fileUrl
            );
            console.log(`📎 Registered attachment mapping: ${optimisticAttachment.optimisticId} → ${serverAttachment.fileUrl}`);
          }
        });
      }
     
      // Ikke kall addMessage - optimistiske meldingen forblir uendret visuelt
    } else {
      // 📝 Vanlig ny melding fra andre brukere
      addMessage(message);
      console.log(`💬 Ny melding ${message.id} lagt til i samtale ${message.conversationId}`);
    }
    
    updateConversationTimestamp(message.conversationId, message.sentAt);
  } catch (error) {
    console.error(`❌ Klarte ikke behandle melding ${message.id}:`, error);
    return;
  }
 
  // Resten av koden forblir uendret...
  if (!message.isSilent && !message.isSystemMessage) {
    handleIncomingMessage(message, userId);
  }

  const conversation = conversations.find(c => c.id === message.conversationId);
  const userIdAsNumber = userId ?? null;
 
  // 🔧 FIX: Bruk faktisk store-tilstand i stedet for parametere
  const isInCurrentConversation = message.conversationId === actualCurrentConversationId;
  const shouldShowToast = message.senderId !== userIdAsNumber &&
    (!isInCurrentConversation || !isAtBottom) && // 🆕 Sjekk faktisk tilstand
    !message.isSilent &&
    !message.isSystemMessage;

  if (shouldShowToast) {
    showNotificationToastNative({
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
};


export const handleReaction = async (
  reaction: ReactionDTO, 
  notification: MessageNotificationDTO | undefined, 
  userId: number | null
) => {
  console.log("🎉 Mottatt reaksjon via useChatHub:", reaction);

  const { updateMessageReactions, updateSearchResultReactions, searchMode } = useChatStore.getState();

  if (notification?.conversationId) {
    await preloadMessagesForConversation(notification.conversationId);
  }

  updateMessageReactions(reaction);
  handleIncomingReaction(reaction, userId, notification || undefined);

  if (searchMode) {
    updateSearchResultReactions(reaction);
  }
};

export const handleRequestApproved = async (notification: MessageNotificationDTO) => {
  console.log("✅ Godkjent forespørsel via useChatHub:", notification); 
  const convId = notification.conversationId;
  if (!convId) return;

  showNotificationToastNative({
    senderName: notification.senderName ?? "Someone",
    messagePreview: notification.messagePreview,
    conversationId: convId,
    type: NotificationType.MessageRequestApproved,
  });

  await finalizeConversationApproval(convId, true, notification);
};

export const handleMessageRequestReceived = async (
  data: MessageRequestCreatedDto,
  userId: number | null,
  checkAndExecute: CheckAndExecuteFunction,
  syncPendingConversation: SyncPendingConversationFunction,
) => {
  await checkAndExecute(async () => {
    if (data.notification) {
      await handleIncomingNotification(data.notification);
      await syncPendingConversation(data.conversationId);
      
      // Convert userId to number for comparison
      const userIdAsNumber = userId ?? null;
      
      if (data.notification.senderId !== userIdAsNumber) {
        showNotificationToastNative({
          senderName: data.notification.senderName,
          messagePreview: data.notification.messagePreview,
          type: NotificationType.MessageRequest,
          conversationId: data.conversationId,
        });
      }
    }
  });
};

export const handleMessageDeleted = async (data: { conversationId: number; message: MessageDTO }) => {
  console.log("🗑️ Mottatt slettet melding via useChatHub:", data);
  
  const { conversationId, message } = data;
  const { conversationIds, updateMessage } = useChatStore.getState();
  
  if (conversationIds.has(conversationId)) {
    console.log(`✅ Oppdaterer slettet melding ${message.id} i samtale ${conversationId}`);
    updateMessage(conversationId, message.id, message);
    console.log(`🔄 Melding ${message.id} oppdatert med isDeleted: ${message.isDeleted}`);
  } else {
    console.log(`⚠️ Samtale ${conversationId} finnes ikke i store, hopper over oppdatering`);
  }
};