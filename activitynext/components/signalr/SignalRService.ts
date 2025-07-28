// Sentral SignalR service som håndterer tilkobling og ruter events
"use client";
import { useChatHub } from "@/hooks/signalr/useChatHub";
import { MessageDTO, ReactionDTO } from "@/types/MessageDTO";
import { MessageRequestCreatedDto } from "@/types/MessageRequestCreatedDto";
import { MessageNotificationDTO } from "@/types/MessageNotificationDTO";
import { GroupRequestCreatedDto } from "@/types/GroupRequestDTO";
import { GroupNotificationUpdateDTO } from "@/types/GroupNotificationUpdateDTO";
import { GroupDisbandedDto } from "@/types/GroupDisbandedDTO";
import { NotificationDTO } from "@/types/NotificationEventDTO";

interface SignalREventHandlers {
  // Chat events
  onMessage?: (message: MessageDTO) => void;
  onReaction?: (reaction: ReactionDTO, notification?: MessageNotificationDTO) => void;
  onRequestApproved?: (notification: MessageNotificationDTO) => void;
  onRequestCreated?: (data: MessageRequestCreatedDto) => void;
  onGroupRequestCreated?: (data: GroupRequestCreatedDto) => void;
  onGroupNotificationUpdated?: (data: GroupNotificationUpdateDTO) => void;
  onGroupDisbanded?: (data: GroupDisbandedDto) => void;
  onGroupParticipantsUpdated?: (conversationId: number) => void;
  onMessageDeleted?: (data: { conversationId: number; message: MessageDTO }) => void;
  
  // General notifications
  onNotification?: (notification: NotificationDTO) => void;
}

interface SignalREventHandlers {
  // Chat events
  onMessage?: (message: MessageDTO) => void;
  onReaction?: (reaction: ReactionDTO, notification?: MessageNotificationDTO) => void;
  onRequestApproved?: (notification: MessageNotificationDTO) => void;
  onRequestCreated?: (data: MessageRequestCreatedDto) => void;
  onGroupRequestCreated?: (data: GroupRequestCreatedDto) => void;
  onGroupNotificationUpdated?: (data: GroupNotificationUpdateDTO) => void;
  onGroupDisbanded?: (data: GroupDisbandedDto) => void;
  onGroupParticipantsUpdated?: (conversationId: number) => void;
  onMessageDeleted?: (data: { conversationId: number; message: MessageDTO }) => void;
  
  // General notifications
  onNotification?: (notification: NotificationDTO) => void;
}

export function useSignalRService(handlers: SignalREventHandlers) {
  console.log("🏗️ SignalRService initialized with handlers:", {
    hasOnMessage: !!handlers.onMessage,
    hasOnReaction: !!handlers.onReaction,
    hasOnNotification: !!handlers.onNotification
  });

  useChatHub(
    handlers.onMessage,
    handlers.onReaction,
    handlers.onRequestApproved,
    handlers.onRequestCreated,
    handlers.onGroupRequestCreated,
    handlers.onGroupNotificationUpdated,
    handlers.onGroupDisbanded,
    handlers.onGroupParticipantsUpdated,
    handlers.onMessageDeleted,
    handlers.onNotification
  );
}