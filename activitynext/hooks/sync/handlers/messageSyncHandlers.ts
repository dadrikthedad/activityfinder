import { useChatStore } from "@/store/useChatStore";
import { MessageDTO } from "@/types/MessageDTO";
import { ConversationDTO } from "@/types/ConversationDTO";


/**
 * Handle message from sync event - uses conversation data from sync event
 * instead of making API calls to ensure conversation exists
 */
export const handleMessageSync = async (
  messages: MessageDTO | MessageDTO[],
  conversation?: ConversationDTO, // 👈 Gjør conversation optional
) => {
  // Normaliser til array
  const messageArray = Array.isArray(messages) ? messages : [messages];
  
  console.log("💬 Handling message(s) from sync event:", {
    messageCount: messageArray.length,
    messageIds: messageArray.map(m => m.id),
    conversationId: messageArray[0]?.conversationId,
    hasConversation: !!conversation
  });
 
  const {
    addConversation,
    addMessage,
    updateConversationTimestamp,
  } = useChatStore.getState();
  
  try {
    // 1. Ensure conversation exists in store (kun én gang)
    if (conversation && messageArray.length > 0) {
      addConversation(conversation);
    } else if (messageArray.length > 0) {
      console.log(`⏭️ Skipping conversation handling for messages in conversation ${messageArray[0].conversationId}`);
    }

     // 2. Add all messages to store
    let latestTimestamp = "";
    let latestConversationId = 0;
    
    for (const message of messageArray) {
      addMessage(message);
      console.log(`💬 Message ${message.id} added to conversation ${message.conversationId}`);
      
      // 🆕 Keep track of latest message for timestamp update
      if (message.sentAt > latestTimestamp) {
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