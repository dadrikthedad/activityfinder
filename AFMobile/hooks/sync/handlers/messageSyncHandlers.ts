import { useChatStore } from "@/store/useChatStore";
import { MessageDTO } from "@shared/types/MessageDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";

/**
 * Transform message from sync format (PascalCase) to frontend format (camelCase)
 */
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

/**
 * Handle message from sync event - uses conversation data from sync event
 * instead of making API calls to ensure conversation exists
 */
export const handleMessageSync = async (
  messages: MessageDTO | MessageDTO[] | any | any[],
  conversation?: ConversationDTO,
) => {

  // Normaliser til array og transformer meldinger
  const rawMessageArray = Array.isArray(messages) ? messages : [messages];
  const messageArray = rawMessageArray.map(msg => transformSyncMessage(msg));
 

  console.log("💬 Handling message(s) from sync event:", {
    messageCount: messageArray.length,
    messageIds: messageArray.map(m => m?.id),
    conversationId: messageArray[0]?.conversationId,
    hasConversation: !!conversation
  });
 
  const {
    addConversation,
    addMessageOptimistic: addMessage,
    updateConversationTimestamp,
  } = useChatStore.getState();
 
  try {
    // 1. Ensure conversation exists in store (kun én gang)
    if (conversation && messageArray.length > 0) {
      addConversation(conversation);
    } 
    // 2. Add all messages to store
    let latestTimestamp = "";
    let latestConversationId = 0;
   
    for (const message of messageArray) {
      
      addMessage(message);
      console.log(`💬 Message ${message?.id} added to conversation ${message?.conversationId}`);
     
      // 🆕 Keep track of latest message for timestamp update
      if (message?.sentAt && message.sentAt > latestTimestamp) {
        latestTimestamp = message.sentAt;
        latestConversationId = message.conversationId;
      }
    } 
    // 3. Update conversation timestamp with latest message
    if (latestTimestamp && latestConversationId) {
      updateConversationTimestamp(latestConversationId, latestTimestamp);
    }
   
    console.log(`✅ Successfully handled ${messageArray.length} sync message(s)`);
  } catch (error) {
    console.error(`❌ Failed to handle messages:`, error);
    return;
  }
};