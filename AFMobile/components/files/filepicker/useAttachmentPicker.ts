import { useState } from 'react';
import { Alert, Platform, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { launchCamera, PhotoQuality } from 'react-native-image-picker';
import { RNFile } from '@/utils/files/FileFunctions';

export interface UseAttachmentPickerOptions {
  onFilesSelected?: (files: RNFile[]) => void;
  allowMultipleImages?: boolean;
  allowVideos?: boolean;
  allowDocuments?: boolean;
  imageQuality?: number; // 0.0 to 1.0 for expo-image-picker
  cameraQuality?: PhotoQuality; // enum for react-native-image-picker
}

export const useAttachmentPicker = (options: UseAttachmentPickerOptions = {}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const {
    onFilesSelected,
    allowMultipleImages = true,
    allowVideos = true,
    allowDocuments = true,
    imageQuality = 0.7,
    cameraQuality = 0.7 as PhotoQuality, // Explicitly cast to PhotoQuality
  } = options;

  const handleCamera = async () => {
    if (isCameraActive) return;
    
    setIsCameraActive(true);
    setShowModal(false);
    
    console.log('🎯 Opening camera with optimized settings...');
    
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.2, // Veldig lav kvalitet for minneoptimalisering
        maxWidth: 800, // Redusert størrelse
        maxHeight: 800, // Redusert størrelse
        includeBase64: false, // Ikke inkluder base64 for å spare minne
        includeExtra: false, // Ikke inkluder ekstra metadata
        saveToPhotos: false, // Ikke lagre til galleriet automatisk
      },
      (response) => {
        console.log('📱 Camera response:', { didCancel: response.didCancel, hasAssets: !!response.assets });
        
        if (response.didCancel || response.errorMessage) {
          console.log('❌ Camera cancelled or error:', response.errorMessage);
          setIsCameraActive(false);
          return;
        }
        
        const asset = response.assets?.[0];
        if (!asset || !asset.uri) {
          console.log('❌ No valid asset or URI received');
          setIsCameraActive(false);
          return;
        }
        
        const file: RNFile = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          size: asset.fileSize || 0
        };
        
        console.log('✅ Camera file created:', file.name);
        onFilesSelected?.([file]);
        setIsCameraActive(false);
      }
    );
  };

  const handleImagePicker = async () => {
    setShowModal(false);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: allowVideos ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: imageQuality,
      allowsMultipleSelection: allowMultipleImages,
    });

    if (!result.canceled && result.assets.length > 0) {
      const files: RNFile[] = result.assets.map((asset, index) => {
        const hasVideoExtension = asset.uri.includes('.mp4') || asset.uri.includes('.mov') || asset.uri.includes('.avi');
        const hasVideoType = asset.type?.includes('video');
        const hasVideoDuration = asset.duration != null && asset.duration > 0;
        const isVideo = hasVideoType || (hasVideoExtension && hasVideoDuration);
        
        let mimeType: string = asset.type || '';
        
        if (mimeType === 'image' || (mimeType === '' && !isVideo)) {
          const fileName = asset.fileName || '';
          if (fileName.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (fileName.toLowerCase().includes('.gif')) {
            mimeType = 'image/gif';
          } else if (fileName.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          } else {
            mimeType = 'image/jpeg';
          }
        } else if (mimeType === 'video' || (mimeType === '' && isVideo)) {
          mimeType = 'video/mp4';
        }
        
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        
        return {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `${isVideo ? 'video' : 'image'}_${Date.now()}_${index}.${fileExtension}`,
          size: asset.fileSize || 0
        };
      });
      
      console.log('📷 Library files selected:', files.map(f => ({ name: f.name, type: f.type })));
      onFilesSelected?.(files);
    }
  };

  const handleDocumentPicker = async () => {
    setShowModal(false);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const files: RNFile[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.mimeType || 'application/octet-stream',
          name: asset.name,
          size: asset.size || 0
        }));
        
        onFilesSelected?.(files);
      }
    } catch (err) {
      console.error('Error picking file:', err);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const showPicker = () => {
    const actions: string[] = [];
    const actionCallbacks: (() => void)[] = [];

    // Build available options based on configuration
    actions.push('Take Photo');
    actionCallbacks.push(handleCamera);

    actions.push('Choose from Library');
    actionCallbacks.push(handleImagePicker);

    if (allowDocuments) {
      actions.push('Select File');
      actionCallbacks.push(handleDocumentPicker);
    }

    actions.push('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: actions,
          cancelButtonIndex: actions.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex < actionCallbacks.length) {
            actionCallbacks[buttonIndex]();
          }
        }
      );
    } else {
      setShowModal(true);
    }
  };

  return {
    showPicker,
    showModal,
    setShowModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
    isCameraActive,
    // For programmatic access to individual methods
    openCamera: handleCamera,
    openImagePicker: handleImagePicker,
    openDocumentPicker: handleDocumentPicker,
  };
};