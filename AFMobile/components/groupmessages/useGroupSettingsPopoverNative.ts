// hooks/useGroupSettingsPopoverNative.ts
import { useState, useCallback } from 'react';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useUploadGroupImageNative } from '@/hooks/files/useUploadGroupImageNative';
import { useChatStore } from '@/store/useChatStore';
import { useUpdateGroupName } from '@/hooks/messages/useUpdateGroupName';
import * as ImagePicker from 'expo-image-picker';

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
  const [groupImageUrl, setGroupImageUrl] = useState<string | null>(
    currentConversation?.groupImageUrl || user.profileImageUrl
  );

  // Group name state and hooks
  const { update: updateGroupNameAPI, updating: updatingGroupName, error: groupNameError } = useUpdateGroupName();
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [tempGroupName, setTempGroupName] = useState(
    currentConversation?.groupName || user.fullName || ''
  );

  // Display name - use updated name from store if available
  const displayName = currentConversation?.groupName || user.fullName;

  // Group image handlers - React Native version
  const handleImageUpload = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      try {
        console.log('🔄 Uploading group image:', asset.uri);
        
        // Convert ImagePicker asset to format expected by upload function
        const imageData = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'group-image.jpg',
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
    },
    [uploadGroupImage, conversationId, updateConversation]
  );

  const triggerImageUpload = useCallback(async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to change the group image!');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await handleImageUpload(result.assets[0]);
    }
  }, [handleImageUpload]);

  // Group name handlers (same as web version)
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