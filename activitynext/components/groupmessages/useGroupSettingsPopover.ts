// hooks/useGroupSettingsPopover.ts
import { useState, useCallback } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useUploadGroupImage } from "@/hooks/image/useUploadGroupImage";
import { useChatStore } from "@/store/useChatStore";
import { useUpdateGroupName } from "@/components/messages/useUpdateGroupName";

interface UseGroupSettingsPopoverProps {
  user: UserSummaryDTO;
  conversationId: number;
  onClose?: () => void;
}

export function useGroupSettingsPopover({
  user,
  conversationId,
}: UseGroupSettingsPopoverProps) {
  
  // Get current conversation from store
  const currentConversation = useChatStore((state) => 
    state.conversations.find(conv => conv.id === conversationId)
  );
  
  const updateConversation = useChatStore((state) => state.updateConversation);
  
  // Group image state and hooks
  const { upload: uploadGroupImage, uploading: uploadingImage, error: uploadError } = useUploadGroupImage();
  const [groupImageUrl, setGroupImageUrl] = useState<string | null>(
    currentConversation?.groupImageUrl || user.profileImageUrl
  );

  // Group name state and hooks
  const { update: updateGroupNameAPI, updating: updatingGroupName, error: groupNameError } = useUpdateGroupName();
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [tempGroupName, setTempGroupName] = useState(
    currentConversation?.groupName || user.fullName || ""
  );

  // Display name - use updated name from store if available
  const displayName = currentConversation?.groupName || user.fullName;

  // Group image handlers
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log("🔄 Uploading group image:", file.name);
      const imageUrl = await uploadGroupImage(file, conversationId);
      console.log("✅ Got imageUrl from API:", imageUrl);
      
      if (imageUrl) {
        setGroupImageUrl(imageUrl);
        console.log("📝 Set groupImageUrl to:", imageUrl);
        
        // Update store immediately
        updateConversation(conversationId, { groupImageUrl: imageUrl });
        console.log("🏪 Updated conversation in store:", conversationId);
      }
    } catch (err) {
      console.error("Failed to upload group image:", err);
    }
  }, [uploadGroupImage, conversationId, updateConversation]);

  const triggerImageUpload = useCallback(() => {
    const input = document.getElementById('group-image-upload-settings') as HTMLInputElement;
    input?.click();
  }, []);

  // Group name handlers
  const handleStartEditGroupName = useCallback(() => {
    setTempGroupName(currentConversation?.groupName || user.fullName || "");
    setIsEditingGroupName(true);
  }, [currentConversation?.groupName, user.fullName]);

  const handleCancelEditGroupName = useCallback(() => {
    setIsEditingGroupName(false);
    setTempGroupName(currentConversation?.groupName || user.fullName || "");
  }, [currentConversation?.groupName, user.fullName]);

  const handleSaveGroupName = useCallback(async () => {
    if (!tempGroupName.trim()) return;
    
    try {
      console.log("🔄 Updating group name to:", tempGroupName);
      
      const success = await updateGroupNameAPI(conversationId, tempGroupName.trim());
      
      if (success) {
        // Update store
        updateConversation(conversationId, { groupName: tempGroupName.trim() });
        setIsEditingGroupName(false);
        console.log("✅ Group name updated successfully");
      }
    } catch (err) {
      console.error("Failed to update group name:", err);
    }
  }, [conversationId, tempGroupName, updateGroupNameAPI, updateConversation]);

  return {
    // Group image
    groupImageUrl,
    uploadingImage,
    uploadError,
    handleImageUpload,
    triggerImageUpload,
    
    // Group name
    isEditingGroupName,
    tempGroupName,
    updatingGroupName,
    handleStartEditGroupName,
    handleCancelEditGroupName,
    handleSaveGroupName,
    setTempGroupName,
    groupNameError,
    
    // Display
    displayName,
  };
}