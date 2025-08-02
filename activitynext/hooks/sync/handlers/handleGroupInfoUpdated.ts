import { useChatStore } from "@/store/useChatStore";
import { handleMessageSync } from "./messageSyncHandlers";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { ConversationDTO } from "@/types/ConversationDTO";
import { MessageDTO } from "@/types/MessageDTO";

interface GroupInfoUpdatedEventData {
  conversation: ConversationDTO;
  message?: MessageDTO;
}

/**
 * Handle GROUP_INFO_UPDATED sync event
 * Updates conversation info and optionally adds system message
 */
export const handleGroupInfoUpdated = async (
  eventData: GroupInfoUpdatedEventData,
  currentUserId: number | null,
) => {
  const { pendingMessageRequests, updatePendingRequest, addMessage, addConversation } = useChatStore.getState();
 
  // Siden eventData alltid har conversation property nå
  const conversation = eventData.conversation;
  const currentUserParticipant = conversation.participants
    .find((p: UserSummaryDTO) => p.id === currentUserId);
 
  try {
    if (currentUserParticipant?.groupRequestStatus === 'Accepted' ||
        currentUserParticipant?.groupRequestStatus === 'Creator') {
      // Godkjent bruker - full handleMessageSync
      console.log(`✅ User ${currentUserId} is approved - using full sync`);
       
      // Sjekk om message eksisterer før vi sender den
      if (eventData.message) {
        await handleMessageSync(eventData.message, conversation);
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
      if (eventData.message && pendingExists) {
        console.log(`💬 Adding system message to existing pending conversation ${conversation.id}`);
        addMessage(eventData.message);
      } else if (eventData.message) {
        console.log(`⏭️ Skipping system message - pending conversation ${conversation.id} not found in pending requests`);
      }
    }
   
    console.log(`✅ Successfully handled GROUP_INFO_UPDATED for conversation ${conversation.id}`);
  } catch (error) {
    console.error(`❌ Failed to handle GROUP_INFO_UPDATED:`, error);
  }
};