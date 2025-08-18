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
import { useAttachmentPicker } from "@/components/files/filepicker/useAttachmentPicker";
import useAttachmentViewer from "./files/AttachmentViewer";
import { RNFile } from "@/utils/files/FileFunctions";
import SpinnerNative from "@/components/common/SpinnerNative";

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
  const [showUploadModal, setShowUploadModal] = useState(false);
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
    type: 'image/jpeg', // Default to jpeg, could be improved to detect actual type
    name: 'Profile Picture',
    size: 0,
  };

  // Use AttachmentViewer for fullscreen image viewing
  const { openFile } = useAttachmentViewer({
    files: [profileImageFile],
    viewerOptions: {
      showDownload: false, // Skjul download for profilbilde
      showShare: false,    // Skjul share for profilbilde
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
      setShowUploadModal(true); // Show upload confirmation modal
    } catch (err) {
      console.error('Failed to process selected image:', err);
      Alert.alert("Error", "Failed to process selected image. Please try again.");
    }
  }, []);

  // Use AttachmentPicker hook
  const {
    showPicker,
    showModal: showAttachmentModal,
    setShowModal: setShowAttachmentModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
  } = useAttachmentPicker({
    onFilesSelected: handleFilesSelected,
    allowMultipleImages: false,
    allowVideos: false,
    allowDocuments: false,
    imageQuality: 0.8,
    cameraQuality: 0.8,
  });

  const handleUpload = async () => {
    if (!selectedFile || !userId) {
      Alert.alert("Error", "No image selected or user not authenticated.");
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
      Alert.alert("Error", "Failed to upload profile picture. Please try again.");
    }
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    resetUpload();
  };

  const triggerImageUpload = useCallback(() => {
    showPicker();
  }, [showPicker]);

  // Handle avatar press - open fullscreen view
  const handleAvatarPress = () => {
    openFile(0); // Open the profile image in AttachmentViewer
  };

  useEffect(() => {
    setImgLoading(true);
  }, [imageUrl]);

  const handleImageLoaded = () => {
    setImgLoading(false);
  };

  const handleImageError = () => {
    setImgLoading(false);
    console.warn('Failed to load profile image:', imageUrl);
  };

  const displayImageUrl = previewUrl || imageUrl;

  const borderWidth = 4;

  const getImageSource = (url: string | null | undefined) => {
    // Handle null/undefined
    if (!url || url.trim() === '') {
      return require('@/assets/images/default-avatar.png'); // Adjust path to your actual asset
    }
    
    // Handle local default paths
    if (url.startsWith('/default-avatar') || url === '/default-avatar.png') {
      return require('@/assets/images/default-avatar.png'); // Adjust path to your actual asset
    }
    
    if (url.startsWith('/default-group') || url === '/default-group.png') {
      return require('@/assets/images/default-group.png'); // Adjust path to your actual asset
    }
    
    // Handle regular URLs
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
          {imgLoading && (
            <View style={[
              styles.loadingOverlay, 
              { 
                borderRadius: size / 2,
              }
            ]}>
              <SpinnerNative />
            </View>
          )}
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
            onLoad={handleImageLoaded}
            onError={handleImageError}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* Edit Button */}
      {isEditable && (
        <View style={styles.editButtonContainer}>
          <ButtonNative
            text="Edit Profile Picture"
            onPress={triggerImageUpload}
            variant="outline"
            size="small"
          />
        </View>
      )}

      {/* Upload Confirmation Modal (only shown when file is selected) */}
      {selectedFile && (
        <Modal
          visible={showUploadModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseUploadModal}
        >
          <View style={styles.uploadModalOverlay}>
            <TouchableOpacity 
              style={styles.uploadModalBackground} 
              onPress={handleCloseUploadModal}
              activeOpacity={1}
            />
            <View style={styles.uploadModalContent}>
              {/* Preview Image */}
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>

              <Text style={styles.confirmText}>
                Save this as your new profile picture?
              </Text>

              {selectedFile && (
                <Text style={styles.fileName}>
                  {selectedFile.name}
                </Text>
              )}
              
              {uploadError && (
                <Text style={styles.errorText}>{uploadError}</Text>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <ButtonNative
                  text={uploading ? "Saving..." : "Save"}
                  onPress={handleUpload}
                  variant="primary"
                  disabled={uploading}
                  loading={uploading}
                  loadingText="Saving..."
                  style={styles.actionButton}
                />
                <ButtonNative
                  text="Cancel"
                  onPress={handleCloseUploadModal}
                  variant="secondary"
                  style={styles.actionButton}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* AttachmentPicker Modal */}
      <Modal
        visible={showAttachmentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAttachmentModal(false)}
      >
        <View style={styles.attachmentModalOverlay}>
          <TouchableOpacity 
            style={styles.attachmentModalBackground} 
            onPress={() => setShowAttachmentModal(false)}
            activeOpacity={1}
          />
          <View style={styles.attachmentModalContent}>
            <Text style={styles.attachmentModalTitle}>Select Image Source</Text>
            
            <View style={styles.attachmentButtonContainer}>
              <ButtonNative
                text="Camera"
                onPress={handleCamera}
                variant="primary"
                fullWidth
                style={styles.attachmentButton}
              />
              <ButtonNative
                text="Photo Library"
                onPress={handleImagePicker}
                variant="outline"
                fullWidth
                style={styles.attachmentButton}
              />
              <ButtonNative
                text="Cancel"
                onPress={() => setShowAttachmentModal(false)}
                variant="secondary"
                fullWidth
                style={styles.attachmentButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#1C6B1C', // Border fargen som bakgrunn
    position: 'relative',
  },
  borderContainer: {
    backgroundColor: '#1C6B1C', // Border fargen
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    backgroundColor: '#f0f0f0',
  },
  editButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },

  // Upload confirmation modal
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  uploadModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#1C6B1C',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1f2937',
  },
  fileName: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  
  // AttachmentPicker Modal styles
  attachmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentModalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  attachmentModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1f2937',
  },
  attachmentButtonContainer: {
    gap: 12,
  },
  attachmentButton: {
    marginBottom: 0,
  },
});