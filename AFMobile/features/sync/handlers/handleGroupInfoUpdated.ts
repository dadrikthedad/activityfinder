import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { handleMessageSync } from "./messageSyncHandlers";
import { GroupRequestStatus } from "@shared/types/UserSummaryDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { MessageDTO } from "@shared/types/MessageDTO";
import { deriveGroupRequestStatus } from "@/features/conversation/utils/conversationHelpers";

interface GroupInfoUpdatedEventData {
  conversation?: ConversationDTO;
  conversationData?: ConversationDTO;
  message?: MessageDTO;
  systemMessage?: MessageDTO;
}

export const handleGroupInfoUpdated = async (
  eventData: GroupInfoUpdatedEventData,
  currentUserId: string | null,
) => {
  console.log("🍌 BANAN handleGroupInfoUpdated eventData:", {
    eventData: eventData,
    keys: Object.keys(eventData),
    hasConversation: !!eventData.conversation,
    hasConversationData: !!eventData.conversationData,
    hasMessage: !!eventData.message,
    hasSystemMessage: !!eventData.systemMessage
  });

  const { addMessageOptimistic: addMessage } = useChatStore.getState();
  const { pendingConversations, updatePendingConversation, addConversation } = useConversationStore.getState();

  const conversation = eventData.conversation || eventData.conversationData;
  const message = eventData.message || eventData.systemMessage;

  console.log("🔍 DEBUG extracted data:", {
    conversation: conversation ? { id: conversation.id, groupName: conversation.groupName } : null,
    message: message ? { id: message.id, text: message.text } : null,
    currentUserId: currentUserId
  });

  if (!conversation) {
    console.error('❌ No conversation data found in GROUP_INFO_UPDATED event');
    return;
  }

  const currentUserParticipant = conversation.participants
    .find((p) => p.user.id === currentUserId);

  const requestStatus = currentUserParticipant
    ? deriveGroupRequestStatus(currentUserParticipant)
    : undefined;

  console.log("🍌 BANAN user participant:", {
    currentUserParticipant: currentUserParticipant,
    requestStatus,
  });

  try {
    if (requestStatus === GroupRequestStatus.Approved ||
        requestStatus === GroupRequestStatus.Creator) {
      console.log(`✅ User ${currentUserId} is approved - using full sync`);

      if (message) {
        console.log("🍌 BANAN: Calling handleMessageSync with:", { message, conversation });
        await handleMessageSync(message, conversation);
      } else {
        console.log(`ℹ️ No system message - only updating conversation`);
        addConversation(conversation);
      }
    } else {
      console.log(`⏳ User ${currentUserId} is pending - updating pending request`);
      updatePendingConversation(conversation.id, {
        groupName: conversation.groupName,
        groupImageUrl: conversation.groupImageUrl,
        participants: conversation.participants
      });

      const pendingExists = pendingConversations.some(c => c.id === conversation.id);
      if (message && pendingExists) {
        console.log(`💬 Adding system message to existing pending conversation ${conversation.id}`);
        addMessage(message);
      } else if (message) {
        console.log(`⏭️ Skipping system message - pending conversation ${conversation.id} not found in pending requests`);
      }
    }

    console.log(`✅ Successfully handled GROUP_INFO_UPDATED for conversation ${conversation.id}`);
  } catch (error) {
    console.error(`❌ Failed to handle GROUP_INFO_UPDATED:`, error);
  }
};
