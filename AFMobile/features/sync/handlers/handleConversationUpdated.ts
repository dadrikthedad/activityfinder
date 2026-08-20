import { useConversationStore } from "@/store/useConversationStore";
import { ConversationDTO } from "@shared/types/ConversationDTO";

export interface ConversationUpdatedSyncData {
  conversationId: number;
  updateType: "GroupNameChanged" | "GroupImageChanged";
  updatedBy: number;
  updatedAt: string;
  oldName?: string;
  newName?: string;
  oldImageUrl?: string;
  newImageUrl?: string;
}

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
    useConversationStore.getState().updateConversation(conversationId, updates);
    console.log(`✅ Conversation ${conversationId} updated with`, updates);
  } else {
    console.warn(`⚠️ No valid updates applied for conversation ${conversationId}`);
  }
}
