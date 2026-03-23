// SignalRClient.tsx - React Native versjon
import React from 'react';
import { useAuth } from "@/context/AuthContext";
import { useChatStore } from "@/store/useChatStore";
import { useStore } from "zustand";
import { useChatHub } from "@/hooks/signalr/useChatHub";
import { useUserCacheStore } from "@/store/useUserCacheStore";

import {
  handleMessage,
  handleReaction,
  handleRequestApproved,
  handleMessageRequestReceived,
  handleMessageDeleted
} from "./handlers/messageHandlers";
import {
  handleGroupRequestCreated,
  handleGroupNotificationUpdated,
  handleGroupDisbanded,
  handleGroupParticipantsUpdated
} from "./handlers/groupHandlers";
import { ensureConversationExists } from "@/utils/messages/ensureConversationExists";

import { usePendingConversationSync } from "@/hooks/messages/getPendingConversationById";
import { useConversationUpdate } from "@/hooks/common/useConversationUpdate";
import { useSimpleBootstrapCheck } from "./useSimpleBootstrapCheck";

export default function SignalRClientNative(): null {
  const { userId } = useAuth();
  const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
  const showMessages = useChatStore.getState().showMessages;
  
  const { syncPendingConversation } = usePendingConversationSync();
  const { refreshConversation } = useConversationUpdate();
  const { checkAndExecute } = useSimpleBootstrapCheck();
  const updateUser = useUserCacheStore((state) => state.updateUser);

  useChatHub(
    // onMessage
    async (message) => {
      await handleMessage(message, userId, currentConversationId, showMessages, ensureConversationExists);
    },
    // onReaction
    async (reaction, notification) => {
      await handleReaction(reaction, notification, userId);
    },
    // onRequestApproved
    async (notification) => {
      await handleRequestApproved(notification);
    },
    // onRequestCreated
    async (data) => {
      await handleMessageRequestReceived(data, userId, checkAndExecute, syncPendingConversation);
    },
    // onGroupRequestCreated
    async (data) => {
      await handleGroupRequestCreated(data, userId, checkAndExecute, syncPendingConversation);
    },
    // onGroupNotificationUpdated
    async (data) => {
      await handleGroupNotificationUpdated(data, userId, refreshConversation);
    },
    // onGroupDisbanded
    async (data) => {
      await handleGroupDisbanded(data, currentConversationId);
    },
    // onGroupParticipantsUpdated
    async (conversationId) => {
      await handleGroupParticipantsUpdated(conversationId, syncPendingConversation);
    },
    // onMessageDeleted
    async (data) => {
      await handleMessageDeleted(data);
    },
    // onUserProfileUpdated
    async (data) => {
      updateUser(data.userId, data.updatedValues);
      console.log('⚡ Real-time profile update via SignalR:', data.updatedFields, data.updatedValues);
    },
    // onUserBlockedUpdated
    async (data) => {
      const { setUser } = useUserCacheStore.getState();
      setUser(data);
      console.log('🚫 You have been blocked/unblocked:', data.fullName);
    },
  );

  return null;
}
