// hooks/sync/handlers/messageHandlers.ts - Properly typed sync handlers
import { useChatStore } from "@/store/useChatStore";
import { ConversationDTO } from "@shared/types/ConversationDTO";




export interface ConversationUpdatedSyncData {
  conversationId: number;
  updateType: "GroupNameChanged" | "GroupImageChanged"; // ← utvid etter behov
  updatedBy: number;
  updatedAt: string;

  // Valgfrie felt avhengig av updateType:
  oldName?: string;
  newName?: string;

  oldImageUrl?: string;
  newImageUrl?: string;
}


// ✅ TYPED: Conversation updated handler
export async function handleConversationUpdated(data: ConversationUpdatedSyncData): Promise<void> {
  const { conversationId, updateType, newName, newImageUrl } = data;

  console.log(`🔄 Conversation updated via sync: ${conversationId}`, data);

  const updates: Partial<ConversationDTO> = {};

  if (updateType === "GroupNameChanged" && newName) {
    updates.groupName = newName;
  }

  if (updateType === "GroupImageChanged" && newImageUrl) {
    updates.groupImageUrl = newImageUrl;
  }

  if (Object.keys(updates).length > 0) {
    useChatStore.getState().updateConversation(conversationId, updates);
    console.log(`✅ Conversation ${conversationId} updated with`, updates);
  } else {
    console.warn(`⚠️ No valid updates applied for conversation ${conversationId}`);
  }
}

//  Conversation read handler hvis vi trenger å marke samtaler som lest, kommentert ut
// export async function handleConversationRead(data: ConversationReadSyncData): Promise<void> {
//   const { conversationId, userId } = data;
  
//   console.log(`👁️ Conversation marked as read via sync: ${conversationId} by user ${userId}`);
  
//   // Update unread status
//   const chatStore = useChatStore.getState();
  
//   // Remove from unread conversations if method exists
//   if (chatStore.removeUnreadConversationId) {
//     chatStore.removeUnreadConversationId(conversationId);
//   }
  
//   console.log(`✅ Conversation ${conversationId} marked as read via sync`);
// }