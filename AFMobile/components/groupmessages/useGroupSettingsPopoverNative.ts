// hooks/useGroupSettingsPopoverNative.ts
import { useState, useCallback } from 'react';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUploadGroupImageNative } from '@/hooks/files/useUploadGroupImageNative';
import { useChatStore } from '@/store/useChatStore';
import { useUpdateGroupName } from '@/hooks/messages/useUpdateGroupName';
import { useAttachmentPicker } from '@/components/files/filepicker/useAttachmentPicker';
import { RNFile } from '@/utils/files/FileFunctions';

interface UseGroupSettingsPopoverNativeProps {
  user: UserSummaryDTO;
  conversationId: number;
  onClose?: () => void;
}

export function useGroupSettingsPopoverNative({
  user,
  conversationId,
  onClose,
}: UseGroupSettingsPopoverNativeProps) {
  // Get current conversation from store
  const currentConversation = useChatStore((state) =>
    state.conversations.find((conv) => conv.id === conversationId)
  );

  const updateConversation = useChatStore((state) => state.updateConversation);

  // Group image state and hooks
  const { upload: uploadGroupImage, uploading: uploadingImage, error: uploadError } = useUploadGroupImageNative();
  const [groupImageUrl, setGroupImageUrl] = useState<string | undefined>(
    currentConversation?.groupImageUrl || undefined
  );

  // Group name state and hooks
  const { update: updateGroupNameAPI, updating: updatingGroupName, error: groupNameError } = useUpdateGroupName();
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [tempGroupName, setTempGroupName] = useState(
    currentConversation?.groupName || user.fullName || ''
  );

  // Display name - use updated name from store if available
  const displayName = currentConversation?.groupName || user.fullName;

  // Handle file selection from AttachmentPicker
  const handleFilesSelected = useCallback(async (files: RNFile[]) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Take first file (should be an image)
    
    try {
      console.log('🔄 Uploading group image:', file.uri);
      
      // Convert RNFile to format expected by upload function
      const imageData = {
        uri: file.uri,
        type: file.type,
        name: file.name,
      };

      const imageUrl = await uploadGroupImage(imageData, conversationId);
      console.log('✅ Got imageUrl from API:', imageUrl);

      if (imageUrl) {
        setGroupImageUrl(imageUrl);
        console.log('📝 Set groupImageUrl to:', imageUrl);

        // Update store immediately
        updateConversation(conversationId, { groupImageUrl: imageUrl });
        console.log('🏪 Updated conversation in store:', conversationId);
      }
    } catch (err) {
      console.error('Failed to upload group image:', err);
    }
  }, [uploadGroupImage, conversationId, updateConversation]);

  // Handle group image removal
  const removeGroupImage = useCallback(async () => {
    try {
      console.log('🗑️ Removing group image for conversation:', conversationId);
      
      // Call upload function with "delete" action
      const result = await uploadGroupImage("delete", conversationId);
      console.log('✅ Group image removed successfully:', result);

      // Set to undefined (default image) - consistent with ConversationDTO
      setGroupImageUrl(undefined);
      
      // Update store immediately
      updateConversation(conversationId, { groupImageUrl: undefined });
      console.log('🏪 Updated conversation in store with undefined image:', conversationId);
      
    } catch (err) {
      console.error('Failed to remove group image:', err);
      throw err; // Re-throw so calling component can handle error
    }
  }, [uploadGroupImage, conversationId, updateConversation]);

  // Use AttachmentPicker hook
  const {
    showPicker,
    showModal,
    setShowModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
  } = useAttachmentPicker({
    onFilesSelected: handleFilesSelected,
    allowMultipleImages: false, // Kun ett bilde for gruppebildet
    allowVideos: false, // Ikke tillat videoer for gruppebilde
    allowDocuments: false, // Ikke tillat dokumenter for gruppebilde
    imageQuality: 0.7, // God kvalitet for gruppebilde
    cameraQuality: 0.7, // God kvalitet for kamera
  });

  // Group image handlers - React Native version using AttachmentPicker
  const triggerImageUpload = useCallback(() => {
    // Use the AttachmentPicker instead of direct ImagePicker
    showPicker();
  }, [showPicker]);

  // Group name handlers (same as before)
  const handleStartEditGroupName = useCallback(() => {
    setTempGroupName(currentConversation?.groupName || user.fullName || '');
    setIsEditingGroupName(true);
  }, [currentConversation?.groupName, user.fullName]);

  const handleCancelEditGroupName = useCallback(() => {
    setIsEditingGroupName(false);
    setTempGroupName(currentConversation?.groupName || user.fullName || '');
  }, [currentConversation?.groupName, user.fullName]);

  const handleSaveGroupName = useCallback(async () => {
    if (!tempGroupName.trim()) return;

    try {
      console.log('🔄 Updating group name to:', tempGroupName);

      const success = await updateGroupNameAPI(conversationId, tempGroupName.trim());

      if (success) {
        // Update store
        updateConversation(conversationId, { groupName: tempGroupName.trim() });
        setIsEditingGroupName(false);
        console.log('✅ Group name updated successfully');
        
        // Close modal on success
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to update group name:', err);
    }
  }, [conversationId, tempGroupName, updateGroupNameAPI, updateConversation, onClose]);

  return {
    // Group image
    groupImageUrl,
    uploadingImage,
    uploadError,
    triggerImageUpload,
    removeGroupImage, // Add this new function

    // AttachmentPicker states
    showModal,
    setShowModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,

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