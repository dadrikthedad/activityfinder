import { useChatStore } from "@/store/useChatStore";
import { handleMessageSync } from "./messageSyncHandlers";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { MessageDTO } from "@shared/types/MessageDTO";

interface GroupInfoUpdatedEventData {
  // Support both formats
  conversation?: ConversationDTO;
  conversationData?: ConversationDTO;
  message?: MessageDTO;
  systemMessage?: MessageDTO;
}

/**
 * Handle GROUP_INFO_UPDATED sync event
 * Updates conversation info and optionally adds system message
 */
export const handleGroupInfoUpdated = async (
  eventData: GroupInfoUpdatedEventData,
  currentUserId: number | null,
) => {
  // 🔍 DEBUG: Log raw event data
  console.log("🍌 BANAN handleGroupInfoUpdated eventData:", {
    eventData: eventData,
    keys: Object.keys(eventData),
    hasConversation: !!eventData.conversation,
    hasConversationData: !!eventData.conversationData,
    hasMessage: !!eventData.message,
    hasSystemMessage: !!eventData.systemMessage
  });

  const { pendingMessageRequests, updatePendingRequest, addMessageOptimistic: addMessage, addConversation } = useChatStore.getState();
 
  // Handle both event formats - prioritize 'conversation' but fallback to 'conversationData'
  const conversation = eventData.conversation || eventData.conversationData;
  const message = eventData.message || eventData.systemMessage;
  
  // 🔍 DEBUG: Log extracted data
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
    .find((p: UserSummaryDTO) => p.id === currentUserId);
    
  console.log("🍌 BANAN user participant:", {
    currentUserParticipant: currentUserParticipant,
    groupRequestStatus: currentUserParticipant?.groupRequestStatus
  });
 
  try {
    if (currentUserParticipant?.groupRequestStatus === 'Accepted' ||
        currentUserParticipant?.groupRequestStatus === 'Creator' ||
        currentUserParticipant?.groupRequestStatus === 'Approved') {
      // Godkjent bruker - full handleMessageSync
      console.log(`✅ User ${currentUserId} is approved - using full sync`);
       
      // Sjekk om message eksisterer før vi sender den
      if (message) {
        console.log("🍌 BANAN: Calling handleMessageSync with:", { message, conversation });
        await handleMessageSync(message, conversation);
      } else {
        // Kun conversation update uten system message
        console.log(`ℹ️ No system message - only updating conversation`);
        addConversation(conversation);
      }
    } else {
      // Pending bruker - oppdater pending info
      console.log(`⏳ User ${currentUserId} is pending - updating pending request`);
      updatePendingRequest(conversation.id, {
        groupName: conversation.groupName,
        groupImageUrl: conversation.groupImageUrl,
        participants: conversation.participants
      });
     
      // Legg til system message HVIS pending conversation eksisterer i pendingMessageRequests
      const pendingExists = pendingMessageRequests.some(req => req.conversationId === conversation.id);
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