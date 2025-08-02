// SignalRClient.tsx - Refaktorert og ryddig
"use client";

import { useAuth } from "@/context/AuthContext";
import { useChatStore } from "@/store/useChatStore";
import { useStore } from "zustand";
import { usePendingConversationSync } from "@/hooks/messages/getPendingConversationById";
import { useConversationUpdate } from "@/hooks/common/useConversationUpdate";
import { useSimpleBootstrapCheck } from "./useSimpleBootstrapCheck";
import { useChatHub } from "@/hooks/signalr/useChatHub";

// Import alle handler funksjoner
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

import { handleNotification } from "./handlers/notificationHandlers";
import { ensureConversationExists } from "@/functions/SignalR/ensureConversationExists";

export default function SignalRClient() {
    const { token, userId } = useAuth();
    const currentConversationId = useStore(useChatStore, (state) => state.currentConversationId);
    const showMessages = useChatStore.getState().showMessages;

    // Hooks
    const { syncPendingConversation } = usePendingConversationSync();
    const { refreshConversation } = useConversationUpdate();
    const { checkAndExecute } = useSimpleBootstrapCheck();

    // 🚀 DIREKTE KALL til useChatHub med inline handlers
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

      // onNotification
      async (evt) => {
        await handleNotification(evt, token);
      }
    );

    return null; // Kun sideeffekter
}