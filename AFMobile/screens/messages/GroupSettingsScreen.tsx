// screens/GroupSettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { useGroupSettingsPopoverNative } from '@/components/groupmessages/useGroupSettingsPopoverNative';
import ButtonNative from '@/components/common/ButtonNative';
import { ChevronLeft, Camera } from 'lucide-react-native';
import { ParticipantsListNative } from '@/components/messages/ParticipantsListNative';
import * as ImagePicker from 'expo-image-picker';

interface GroupSettingsScreenProps {
  route: {
    params: {
      user: UserSummaryDTO;
      conversationId: number;
    };
  };
  navigation: any;
}

export default function GroupSettingsScreen({
  route,
  navigation,
}: GroupSettingsScreenProps) {
  const { user, conversationId } = route.params;

  // Get current conversation to access participants
  const currentConversation = useChatStore((state) =>
    state.conversations.find((conv) => conv.id === conversationId)
  );

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
    onClose: () => navigation.goBack(), // Naviger tilbake isteden for å lukke modal
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

  const handleParticipantClick = (participant: UserSummaryDTO) => {
    // Use a basic position since we don't have exact coordinates in this context
    const position = { x: 100, y: 100 };
    
    // Create group data for the popover
    const groupData = currentConversation?.isGroup ? {
      isGroup: true,
      participants: currentConversation.participants,
      conversationId: conversationId,
      isPendingRequest: false, // You might want to check this based on your logic
      onLeaveGroup: undefined, // Add leave group logic if needed
    } : undefined;

    // For now, let's use a simple Alert since we don't have the exact showUserPopover implementation
    // You can replace this with proper modal/sheet implementation later
    const options = ['View Profile', 'Send Message'];
    
    if (groupData?.isGroup && participant.id !== user.id) {
      options.push('Remove from Group'); // Only if current user has permission
    }
    
    options.push('Cancel');
    
    Alert.alert(
      participant.fullName,
      `What would you like to do?`,
      options.map((option) => ({
        text: option,
        style: option === 'Cancel' ? 'cancel' : 'default',
        onPress: () => {
          switch (option) {
            case 'View Profile':
              // Navigate to user profile
              console.log('Navigate to profile for:', participant.fullName);
              // navigation.navigate('UserProfile', { userId: participant.id });
              break;
            case 'Send Message':
              // Navigate to direct conversation
              console.log('Send message to:', participant.fullName);
              // Handle direct message navigation
              break;
            case 'Remove from Group':
              // Handle remove from group
              console.log('Remove from group:', participant.fullName);
              break;
          }
        }
      }))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#ffffff" />
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
              <Camera size={18} color="#ffffff" />
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

        {/* Participants Section */}
        {currentConversation?.participants && currentConversation.participants.length > 0 && (
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              Participants ({currentConversation.participants.length})
            </Text>
            
            <ParticipantsListNative
              participants={currentConversation.participants}
              onParticipantClick={handleParticipantClick}
              showGroupRequestStatus={true}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#1C6B1C',
  },
  backButton: {
    padding: 8,
    marginLeft: -8, // Juster for bedre alignment
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40, // Balanserer back-knappen
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: 40,
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
    alignItems: 'center',
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
    backgroundColor: '#ffffff',
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
  participantsSection: {
    marginTop: 32,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
});