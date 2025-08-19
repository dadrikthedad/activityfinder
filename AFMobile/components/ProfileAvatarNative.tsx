import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { useUploadProfileImage } from "@/hooks/files/useUploadProfileImage";
import { useAuth } from "@/context/AuthContext";
import { AttachmentPicker } from "./files/filepicker/AttachmentPicker";
import useAttachmentViewer from "./files/AttachmentViewer";
import { RNFile } from "@/utils/files/FileFunctions";
import SpinnerNative from "@/components/common/SpinnerNative";
import { showNotificationToastNative, LocalToastType } from "./toast/NotificationToastNative";
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative";

interface Props {
  imageUrl: string;
  size?: number;
  isEditable?: boolean;
  refetchProfile?: () => Promise<void>;
}

export default function ProfileAvatarNative({
  imageUrl,
  size = 192,
  isEditable = false,
  refetchProfile,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RNFile | null>(null);
  const [imageHasLoaded, setImageHasLoaded] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { userId } = useAuth();
  const { confirm } = useConfirmModalNative();

  const {
    upload: uploadProfileImage,
    uploading,
    error: uploadError,
    reset: resetUpload,
  } = useUploadProfileImage();

  // Create file object for AttachmentViewer
  const profileImageFile: RNFile = {
    uri: previewUrl || imageUrl,
    type: 'image/jpeg',
    name: 'Profile Picture',
    size: 0,
  };

  // Use AttachmentViewer for fullscreen image viewing
  const { openFile } = useAttachmentViewer({
    files: [profileImageFile],
    viewerOptions: {
      showDownload: false,
      showShare: false,
    }
  });

  // Create separate viewer for preview image
  const previewFile: RNFile | null = selectedFile ? {
    uri: selectedFile.uri,
    type: selectedFile.type,
    name: selectedFile.name,
    size: selectedFile.size,
  } : null;

  const { openFile: openPreviewFile } = useAttachmentViewer({
    files: previewFile ? [previewFile] : [],
    viewerOptions: {
      showDownload: false,
      showShare: false,
    }
  });

  // Handle file selection from AttachmentPicker
  const handleFilesSelected = useCallback(async (files: RNFile[]) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Take first file (should be an image)
    
    try {
      console.log('🔄 Selected profile image:', file.uri);
      setSelectedFile(file);
      setPreviewUrl(file.uri);
    } catch (err) {
      console.error('Failed to process selected image:', err);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Image Error",
        customBody: "Failed to process selected image. Please try again.",
        position: 'top'
      });
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !userId) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Upload Error",
        customBody: "No image selected or user not authenticated.",
        position: 'top'
      });
      return;
    }

    try {
      console.log('🔄 Uploading profile image:', selectedFile.uri);
      
      // Pass the RNFile directly to uploadProfileImage
      const uploadedUrl = await uploadProfileImage(selectedFile);
      console.log('✅ Profile image uploaded successfully:', uploadedUrl);

      if (uploadedUrl) {
        // Refresh profile to get updated image
        await refetchProfile?.();
        handleCloseUploadModal();
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Success",
          customBody: "Profile picture updated successfully!",
          position: 'top'
        });
      }
    } catch (err) {
      console.error('Failed to upload profile image:', err);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Upload Failed",
        customBody: "Failed to upload profile picture. Please try again.",
        position: 'top'
      });
    }
  };

  // Function to handle removing profile image using existing upload method
  const handleRemoveImage = async () => {
    const confirmed = await confirm({
      title: "Remove Profile Picture",
      message: "Are you sure you want to remove your profile picture? This will set it back to the default avatar."
    });

    if (!confirmed) return;

    setIsRemoving(true);
    try {
      // Use existing upload method with "delete" string to remove image
      await uploadProfileImage("delete");
      await refetchProfile?.();
      
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Success",
        customBody: "Profile picture removed successfully!",
        position: 'top'
      });
    } catch (err) {
      console.error('Failed to remove profile image:', err);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: "Failed to remove profile picture. Please try again.",
        position: 'top'
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Reset imageHasLoaded when imageUrl changes (new image)
  useEffect(() => {
    setImageHasLoaded(false);
  }, [imageUrl]);

  // Handle cancel - reset to original state
  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    resetUpload();
  };

  const handleCloseUploadModal = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    resetUpload();
  };

  // Handle avatar press - open fullscreen view
  const handleAvatarPress = () => {
    openFile(0);
  };

  // Handle preview image press - open fullscreen view of selected image
  const handlePreviewPress = () => {
    if (selectedFile && previewFile) {
      openPreviewFile(0);
    }
  };

  // Loading state management
  const handleImageLoadStart = () => {
    if (!imageHasLoaded) {
      setImgLoading(true);
    }
  };

  const handleImageLoaded = () => {
    setImgLoading(false);
    setImageHasLoaded(true);
  };

  const handleImageError = () => {
    setImgLoading(false);
    setImageHasLoaded(false);
    console.warn('Failed to load profile image:', imageUrl);
  };

  const displayImageUrl = previewUrl || imageUrl;
  const borderWidth = 4;

  const getImageSource = (url: string | null | undefined) => {
    if (!url || url.trim() === '') {
      return require('@/assets/images/default-avatar.png');
    }
    
    if (url.startsWith('/default-avatar') || url === '/default-avatar.png') {
      return require('@/assets/images/default-avatar.png');
    }
    
    if (url.startsWith('/default-group') || url === '/default-group.png') {
      return require('@/assets/images/default-group.png');
    }
    
    return { uri: url };
  };

  // Check if user has a custom profile image (not default)
  const hasCustomImage = imageUrl && 
    !imageUrl.startsWith('/default-avatar') && 
    imageUrl !== '/default-avatar.png' &&
    !imageUrl.startsWith('/default-group') && 
    imageUrl !== '/default-group.png' &&
    imageUrl.trim() !== '';

  return (
    <>
      {/* Profile Avatar - Outer container for border */}
      <View style={[
        styles.borderContainer,
        { 
          width: size + (borderWidth * 2), 
          height: size + (borderWidth * 2), 
          borderRadius: (size + (borderWidth * 2)) / 2,
        }
      ]}>
        <TouchableOpacity
          onPress={handleAvatarPress}
          style={[
            styles.avatarContainer,
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2,
            }
          ]}
          activeOpacity={0.8}
        >
          <Image
            source={getImageSource(displayImageUrl)}
            style={[
              styles.avatarImage, 
              { 
                width: size, 
                height: size, 
                borderRadius: size / 2,
              }
            ]}
            onLoadStart={handleImageLoadStart}
            onLoad={handleImageLoaded}
            onError={handleImageError}
            resizeMode="cover"
          />
          {/* Loading overlay */}
          {(imgLoading || isRemoving) && (
            <View style={[
              styles.loadingOverlay, 
              { 
                width: size,
                height: size,
                borderRadius: size / 2,
              }
            ]}>
              <SpinnerNative />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Edit Button with AttachmentPicker using ButtonNative */}
      {isEditable && (
        <View style={styles.editButtonContainer}>
          {!selectedFile ? (
            <View style={styles.defaultActionsContainer}>
              {/* Edit Profile Picture Button */}
              <AttachmentPicker
                onFilesSelected={handleFilesSelected}
                allowMultipleImages={false}
                allowVideos={false}
                allowDocuments={true}
                imageQuality={0.8}
                cameraQuality={0.8}
                modalTitle="Select Profile Picture"
                useNativeButton={true}
                buttonText="Edit Profile Picture"
                nativeButtonProps={{
                  variant: "primary",
                  size: "medium",
                  style: styles.editButton,
                }}
              />

              {/* Remove Picture Button - only show if user has custom image */}
              {hasCustomImage && (
                <ButtonNative
                  text={isRemoving ? "Removing..." : "Remove Picture"}
                  onPress={handleRemoveImage}
                  variant="secondary"
                  size="medium"
                  disabled={isRemoving}
                  loading={isRemoving}
                  style={styles.removeButton}
                />
              )}
            </View>
          ) : (
            // Show Save/Cancel/Change buttons when file is selected
            <View style={styles.actionButtonsContainer}>
              <View style={styles.actionButtonRow}>
                <ButtonNative
                  text={uploading ? "Saving..." : "Save"}
                  onPress={handleUpload}
                  variant="primary"
                  disabled={uploading}
                  loading={uploading}
                  loadingText="Saving..."
                  style={styles.actionButtonHalf}
                />
                <ButtonNative
                  text="Cancel"
                  onPress={handleCancel}
                  variant="secondary"
                  style={styles.actionButtonHalf}
                />
              </View>
              
              {uploadError && (
                <Text style={styles.errorText}>{uploadError}</Text>
              )}
              
              <AttachmentPicker
                onFilesSelected={handleFilesSelected}
                allowMultipleImages={false}
                allowVideos={false}
                allowDocuments={true}
                imageQuality={0.8}
                cameraQuality={0.8}
                modalTitle="Change Profile Picture"
                useNativeButton={true}
                buttonText="Change Image"
                nativeButtonProps={{
                  variant: "secondary",
                  size: "medium",
                  style: styles.changeImageButton,
                }}
              />
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    borderColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    backgroundColor: '#1C6B1C',
    position: 'relative',
  },
  borderContainer: {
    backgroundColor: '#1C6B1C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  avatarImage: {
    backgroundColor: '#f0f0f0',
  },
  editButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  // New container for default actions (edit + remove)
  defaultActionsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    minWidth: 180,
    alignSelf: 'center', 
  },
  // Updated style for remove button - same size as edit button
  removeButton: {
    minWidth: 180, // Same as editButton
    alignSelf: 'center',
  },
  // Existing styles for action buttons when image is selected
  actionButtonsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  actionButtonHalf: {
    flex: 1,
  },
  changeImageButton: {
    minWidth: 160,
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
});