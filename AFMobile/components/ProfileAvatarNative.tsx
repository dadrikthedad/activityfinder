import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from "react-native";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { useUploadProfileImage } from "@/hooks/files/useUploadProfileImage";
import { useAuth } from "@/context/AuthContext";
import { AttachmentPicker } from "./files/filepicker/AttachmentPicker";
import useAttachmentViewer from "./files/AttachmentViewer";
import { RNFile } from "@/utils/files/FileFunctions";
import SpinnerNative from "@/components/common/SpinnerNative";
import { showNotificationToastNative, LocalToastType } from "./toast/NotificationToastNative";

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
  const [imageHasLoaded, setImageHasLoaded] = useState(false); // ✅ Track if image has loaded once
  const { userId } = useAuth();

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

  // ✅ Create separate viewer for preview image
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
      // ✅ No modal - just update the preview directly
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
      
      // Convert RNFile to format expected by upload function
      const imageData = {
        uri: selectedFile.uri,
        type: selectedFile.type,
        name: selectedFile.name,
      };

      const uploadedUrl = await uploadProfileImage(imageData);
      console.log('✅ Profile image uploaded successfully:', uploadedUrl);

      if (uploadedUrl) {
        // Refresh profile to get updated image
        await refetchProfile?.();
        handleCloseUploadModal();
        Alert.alert("Success", "Profile picture updated successfully!");
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

  // ✅ Reset imageHasLoaded when imageUrl changes (new image)
  useEffect(() => {
    setImageHasLoaded(false);
  }, [imageUrl]);

  // ✅ Handle cancel - reset to original state
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

  // ✅ FIX: Kun vis loading hvis bildet ikke har blitt lastet før
  const handleImageLoadStart = () => {
    if (!imageHasLoaded) {
      setImgLoading(true);
    }
  };

  const handleImageLoaded = () => {
    setImgLoading(false);
    setImageHasLoaded(true); // ✅ Mark that image has loaded successfully
  };

  const handleImageError = () => {
    setImgLoading(false);
    setImageHasLoaded(false); // ✅ Reset on error so we can try loading again
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
          {/* ✅ FIX: Flytt loading overlay til etter Image og bruk absolute positioning */}
          {imgLoading && (
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
            // ✅ Show "Edit Profile Picture" when no file selected
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
          ) : (
            // ✅ Show Save/Cancel/Change buttons when file is selected
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
  // ✅ FIX: Bruk absolute positioning for loading overlay
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
    width: '100%', // Ensure full width for button
  },
  editButton: {
    minWidth: 180, // Set a minimum width for consistency
    alignSelf: 'center', 
  },
  // ✅ New styles for action buttons when image is selected
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