import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { MessageDTO } from "@shared/types/MessageDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";

const transformSyncMessage = (syncMessage: any): MessageDTO => {
  return {
    id: syncMessage.Id || syncMessage.id,
    senderId: syncMessage.SenderId || syncMessage.senderId,
    sender: syncMessage.Sender || syncMessage.sender,
    text: syncMessage.Text || syncMessage.text,
    sentAt: syncMessage.SentAt || syncMessage.sentAt,
    conversationId: syncMessage.ConversationId || syncMessage.conversationId,
    attachments: syncMessage.Attachments || syncMessage.attachments || [],
    reactions: syncMessage.Reactions || syncMessage.reactions || [],
    parentMessageId: syncMessage.ParentMessageId || syncMessage.parentMessageId,
    parentMessageText: syncMessage.ParentMessageText || syncMessage.parentMessageText,
    parentSender: syncMessage.ParentSender || syncMessage.parentSender,
    isRejectedRequest: syncMessage.IsRejectedRequest || syncMessage.isRejectedRequest || false,
    isNowApproved: syncMessage.IsNowApproved || syncMessage.isNowApproved,
    isSilent: syncMessage.IsSilent || syncMessage.isSilent || false,
    isSystemMessage: syncMessage.IsSystemMessage || syncMessage.isSystemMessage || false,
    isDeleted: syncMessage.IsDeleted || syncMessage.isDeleted || false
  };
};

export const handleMessageSync = async (
  messages: MessageDTO | MessageDTO[] | any | any[],
  conversation?: ConversationDTO,
) => {
  const rawMessageArray = Array.isArray(messages) ? messages : [messages];
  const messageArray = rawMessageArray.map(msg => transformSyncMessage(msg));

  console.log("💬 Handling message(s) from sync event:", {
    messageCount: messageArray.length,
    messageIds: messageArray.map(m => m?.id),
    conversationId: messageArray[0]?.conversationId,
    hasConversation: !!conversation
  });

  const { addMessageOptimistic: addMessage } = useChatStore.getState();
  const { addConversation, updateConversationTimestamp } = useConversationStore.getState();

  try {
    if (conversation && messageArray.length > 0) {
      addConversation(conversation);
    }

    let latestTimestamp = "";
    let latestConversationId = 0;

    for (const message of messageArray) {
      addMessage(message);
      console.log(`💬 Message ${message?.id} added to conversation ${message?.conversationId}`);

      if (message?.sentAt && message.sentAt > latestTimestamp) {
        latestTimestamp = message.sentAt;
        latestConversationId = message.conversationId;
      }
    }

    if (latestTimestamp && latestConversationId) {
      updateConversationTimestamp(latestConversationId, latestTimestamp);
    }

    console.log(`✅ Successfully handled ${messageArray.length} sync message(s)`);
  } catch (error) {
    console.error(`❌ Failed to handle messages:`, error);
    return;
  }
};
