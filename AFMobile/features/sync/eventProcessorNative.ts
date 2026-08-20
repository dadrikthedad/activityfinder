import { SyncEventDTO } from '@shared/types/sync/SyncEventDTO';
import { handleMessageSync } from './handlers/messageSyncHandlers';
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { handleGroupInfoUpdated } from './handlers/handleGroupInfoUpdated';
import { getBlockedUsers } from '@/features/blocking/services/blockService';
import { syncPendingConversation } from '@/hooks/messages/syncPendingConversation';

export async function processSyncEventNative(event: SyncEventDTO): Promise<void> {
  const eventData = JSON.parse(event.eventData);
  const currentUserId = useUserCacheStore.getState().currentUser?.id ?? null;
  const { updateMessageReactions } = useChatStore.getState();
  const { addConversation } = useConversationStore.getState();
  const { updateUser, setUser } = useUserCacheStore.getState();

  switch (event.eventType) {
    case 'NewMessage':
    case 'ConversationCreated': {
      const { message, systemMessage, conversation, conversationData } = eventData;
      const { removePendingConversation, addConversation } = useConversationStore.getState();

      const conversationToUse = conversation || conversationData;

      if (conversationToUse) {
        removePendingConversation(conversationToUse.id);
        addConversation(conversationToUse);
      }

      const messages = [];
      if (systemMessage) messages.push(systemMessage);
      if (message) messages.push(message);

      if (messages.length > 0) {
        await handleMessageSync(messages, conversationToUse);
      }
      break;
    }
    case 'PendingConversationCreated': {
      const { groupRequestData, messageRequestData, systemMessage, message } = eventData;
      const { addMessageOptimistic: addMessage } = useChatStore.getState();
      const { conversations } = useConversationStore.getState();

      const requestData = groupRequestData || messageRequestData;

      if (requestData) {
        const conversationExists = conversations.some(conv =>
          conv.id === requestData.conversationId
        );

        if (!conversationExists) {
          // Hent full ConversationDTO og legg den i pending-listen (ny modell)
          await syncPendingConversation(requestData.conversationId);
        }
      }

      const messages = [systemMessage, message].filter(Boolean);
      for (const msg of messages) {
        await addMessage(msg);
      }
      break;
    }
    case 'ConversationRestored':
      addConversation(eventData);
      break;
    case 'MessageDeleted': {
      const { messageId, conversationId } = eventData;
      useChatStore.getState().softDeleteMessage(conversationId, messageId);
      break;
    }
    case 'ReactionUpdated':
    case 'ReactionRemoved': {
      const { reaction, conversation } = eventData;
      updateMessageReactions(reaction);
      addConversation(conversation);
      break;
    }
    case 'GroupInfoUpdated': {
      await handleGroupInfoUpdated(eventData, currentUserId);
      break;
    }
    case 'ConversationLeft': {
      const { removeConversation, removePendingConversation } = useConversationStore.getState();
      removeConversation(eventData);
      removePendingConversation(eventData);
      break;
    }
    case 'UserProfileUpdated':
    case 'MyProfileUpdated': {
      updateUser(eventData.userId, eventData.updatedValues);
      break;
    }
    case 'UserBlocked': {
      // eventData er userId-streng — vi trenger full brukerinfo, så hent oppdatert liste
      const blockedResult = await getBlockedUsers();
      if (blockedResult.success) {
        useUserCacheStore.getState().setBlockedUsers(blockedResult.data);
      }
      break;
    }
    case 'UserUnblocked': {
      // eventData er userId-streng for brukeren som ble fjernet fra blokklisten
      useUserCacheStore.getState().removeBlockedUser(eventData);
      break;
    }
    default:
      console.warn('Unhandled sync event type:', event.eventType);
  }
}
