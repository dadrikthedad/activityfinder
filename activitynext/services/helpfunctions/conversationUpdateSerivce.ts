// services/conversationUpdateService.ts
import { getConversationById } from "@/services/messages/conversationService";
import { useChatStore } from "@/store/useChatStore";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

/**
 * Service for å oppdatere conversation data i real-time
 * Brukes når participants eller annen conversation data endres
 */
export class ConversationUpdateService {
  /**
   * Oppdaterer en conversation med fresh data fra API
   * @param conversationId - ID til samtalen som skal oppdateres
   * @param reason - Årsak til oppdateringen (for logging)
   */
  static async updateConversationParticipants(conversationId: number, reason: string): Promise<boolean> {
    try {
      console.log(`🔄 ${reason} - refreshing conversation ${conversationId}`);
     
      // Hent oppdatert conversation data fra API
      const updatedConversation = await getConversationById(conversationId);
      if (!updatedConversation) {
        console.warn(`❌ Could not fetch updated conversation ${conversationId}`);
        return false;
      }

      const store = useChatStore.getState();
      
      // 🆕 Sjekk om conversation er i hovedlisten
      const isInConversations = store.conversations.some(c => c.id === conversationId);
      
      if (isInConversations) {
        // Oppdater conversation i hovedlisten
        store.updateConversation(conversationId, updatedConversation);
      }
      
      // 🆕 Sjekk om conversation er i pending requests
      const pendingRequest = store.pendingMessageRequests.find(r => r.conversationId === conversationId);

      
      if (pendingRequest) {
        // Oppdater pending request med nye conversation data
        const updatedRequests = store.pendingMessageRequests.map(request => 
          request.conversationId === conversationId 
            ? { ...request, conversation: updatedConversation }
            : request
        );
        
        store.setPendingMessageRequests(updatedRequests);
        
      }
      
      // 🆕 Også oppdater pending cache hvis den finnes
      if (store.pendingRequestsCache.length > 0) {
        const updatedCache = store.pendingRequestsCache.map(request => 
          request.conversationId === conversationId 
            ? { ...request, conversation: updatedConversation }
            : request
        );
        
        store.setCachedPendingRequests(updatedCache);
        console.log(`✅ Updated conversation ${conversationId} in pending cache`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to refresh conversation ${conversationId}:`, error);
      return false;
    }
  }


  /**
   * Oppdaterer flere conversations på en gang
   * @param conversationIds - Array av conversation IDs som skal oppdateres
   * @param reason - Årsak til oppdateringen (for logging)
   */
  static async updateMultipleConversations(conversationIds: number[], reason: string): Promise<void> {
    console.log(`🔄 ${reason} - refreshing ${conversationIds.length} conversations`);
    
    const promises = conversationIds.map(id => 
      this.updateConversationParticipants(id, `Batch update: ${reason}`)
    );

    await Promise.allSettled(promises);
    console.log(`✅ Batch update completed for ${conversationIds.length} conversations`);
  }

  /**
   * Oppdaterer kun participants for en conversation (ikke full refresh)
   * @param conversationId - ID til samtalen
   * @param newParticipants - Nye participants data
   */
  static updateParticipantsOnly(
    conversationId: number, 
    newParticipants: UserSummaryDTO[], // 🆕 Riktig type i stedet for any[]
    reason: string
  ): void {
    try {
      console.log(`🔄 ${reason} - updating participants for conversation ${conversationId}`);
      
      const { updateConversation } = useChatStore.getState();
      updateConversation(conversationId, { participants: newParticipants });

      console.log(`✅ Updated participants for conversation ${conversationId} (${newParticipants.length} participants)`);
    } catch (error) {
      console.error(`❌ Failed to update participants for conversation ${conversationId}:`, error);
    }
  }
};

// Named exports for easier importing
export const updateConversationParticipants = ConversationUpdateService.updateConversationParticipants;
export const updateMultipleConversations = ConversationUpdateService.updateMultipleConversations;
export const updateParticipantsOnly = ConversationUpdateService.updateParticipantsOnly;
