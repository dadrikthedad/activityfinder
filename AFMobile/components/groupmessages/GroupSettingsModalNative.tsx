// components/group/GroupSettingsModalNative.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useGroupSettingsPopoverNative } from './useGroupSettingsPopoverNative';
import ButtonNative from '@/components/common/ButtonNative';
import * as ImagePicker from 'expo-image-picker';

interface GroupSettingsModalNativeProps {
  visible: boolean;
  user: UserSummaryDTO;
  conversationId: number;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function GroupSettingsModalNative({
  visible,
  user,
  conversationId,
  onClose,
}: GroupSettingsModalNativeProps) {
  const {
    groupImageUrl,
    uploadingImage,
    uploadError,
    handleImageUpload,
    triggerImageUpload,
    isEditingGroupName,
    tempGroupName,
    updatingGroupName,
    handleStartEditGroupName,
    handleCancelEditGroupName,
    handleSaveGroupName,
    setTempGroupName,
    groupNameError,
    displayName,
  } = useGroupSettingsPopoverNative({
    user,
    conversationId,
    onClose,
  });

  const handleImagePress = async () => {
    Alert.alert(
      'Change Group Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => pickImage('camera') },
        { text: 'Photo Library', onPress: () => pickImage('library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };

    let result;
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets?.[0]) {
      await handleImageUpload(result.assets[0]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Group Settings</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Group Image */}
          <View style={styles.imageSection}>
            <TouchableOpacity onPress={handleImagePress} style={styles.imageContainer}>
              <Image
                source={{
                  uri: groupImageUrl || user.profileImageUrl || '/default-group.png',
                }}
                style={styles.groupImage}
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>📷</Text>
              </View>
            </TouchableOpacity>
            
            {uploadingImage && (
              <Text style={styles.uploadingText}>Uploading...</Text>
            )}
            
            {uploadError && (
              <Text style={styles.errorText}>{uploadError}</Text>
            )}
          </View>

          {/* Group Name Section */}
          <View style={styles.nameSection}>
            <Text style={styles.currentNameLabel}>Current Name:</Text>
            <Text style={styles.currentName}>{displayName}</Text>
          </View>

          {/* Group Name Editing */}
          {isEditingGroupName ? (
            <View style={styles.editingSection}>
              <TextInput
                style={styles.nameInput}
                value={tempGroupName}
                onChangeText={setTempGroupName}
                placeholder="Enter group name"
                maxLength={100}
                autoFocus
                editable={!updatingGroupName}
              />
              
              {groupNameError && (
                <Text style={styles.errorText}>{groupNameError}</Text>
              )}
              
              <View style={styles.editingButtons}>
                <ButtonNative
                  text={updatingGroupName ? 'Saving...' : 'Save'}
                  onPress={handleSaveGroupName}
                  variant="primary"
                  disabled={updatingGroupName || !tempGroupName?.trim()}
                  style={styles.saveButton}
                />
                
                <ButtonNative
                  text="Cancel"
                  onPress={handleCancelEditGroupName}
                  variant="secondary"
                  disabled={updatingGroupName}
                  style={styles.cancelButton}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <ButtonNative
                text="Change Group Name"
                onPress={handleStartEditGroupName}
                variant="outline"
                fullWidth
                style={styles.actionButton}
              />
              
              <ButtonNative
                text="Change Group Image"
                onPress={handleImagePress}
                variant="outline"
                fullWidth
                style={styles.actionButton}
                disabled={uploadingImage}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 60, // Same width as close button for centering
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1C6B1C',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  imageOverlayText: {
    fontSize: 16,
    color: 'white',
  },
  uploadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  nameSection: {
    marginBottom: 30,
  },
  currentNameLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  currentName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  editingSection: {
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  editingButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
  },
  actionButtons: {
    gap: 16,
    paddingBottom: 40,
  },
  actionButton: {
    marginBottom: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});