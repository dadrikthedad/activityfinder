// screens/GroupSettingsScreen.tsx
// screens/GroupSettingsScreen.tsx
import React, { useState} from 'react';
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
import { ArrowBigLeft, Camera } from 'lucide-react-native';
import { ParticipantsListNative } from '@/components/messages/ParticipantsListNative';
import { AttachmentPickerModal } from '@/components/files/filepicker/AttachmentPickerModal';
import { useLeaveGroup } from '@/hooks/messages/useLeaveGroup';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import AppHeader from '@/components/common/AppHeader';
import InviteUsersModalNative from '@/components/messages/InviteUsersModalNative';

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
    triggerImageUpload,
    // AttachmentPicker states
    showModal,
    setShowModal,
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
    // Group name states
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
    onClose: () => navigation.goBack(),
  });

  // Leave group functionality
  const { leaveGroupMutation, isLeavingGroup, error: leaveGroupError } = useLeaveGroup();
  const { confirm } = useConfirmModalNative();

  // Invite users modal state
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Handle image press - now uses AttachmentPicker
  const handleImagePress = () => {
    triggerImageUpload();
  };

  // Handle leave group with confirmation
  const handleLeaveGroup = async () => {
    const confirmed = await confirm({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group? You will no longer receive messages from this group.',
    });

    if (confirmed) {
      try {
        await leaveGroupMutation(conversationId);
        // Navigate back to MessagesScreen after leaving
        navigation.navigate('MessagesScreen');
      } catch (err) {
        // Error is already handled in the hook
        Alert.alert('Error', 'Failed to leave group. Please try again.');
      }
    }
  };

  // Handle invite users
  const handleInviteUsers = () => {
    setShowInviteModal(true);
  };

  const handleInviteModalClose = () => {
    setShowInviteModal(false);
  };

  const handleInvitesSent = (response: unknown) => {
    console.log('✅ Invitations sent successfully:', response);
    // Optionally refresh participants list or show success message
    setShowInviteModal(false);
  };

  const handleParticipantClick = (participant: UserSummaryDTO) => {
    // Use a basic position since we don't have exact coordinates in this context
    const position = { x: 100, y: 100 };
    
    // Create group data for the popover
    const groupData = currentConversation?.isGroup ? {
      isGroup: true,
      participants: currentConversation.participants,
      conversationId: conversationId,
      isPendingRequest: false,
      onLeaveGroup: undefined,
    } : undefined;

    const options = ['View Profile', 'Send Message'];
    
    if (groupData?.isGroup && participant.id !== user.id) {
      options.push('Remove from Group');
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
              console.log('Navigate to profile for:', participant.fullName);
              break;
            case 'Send Message':
              console.log('Send message to:', participant.fullName);
              break;
            case 'Remove from Group':
              console.log('Remove from group:', participant.fullName);
              break;
          }
        }
      }))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header using AppHeader component */}
      <AppHeader
        title="Group Settings"
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowBigLeft}
      />

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
          
          {leaveGroupError && (
            <Text style={styles.errorText}>{leaveGroupError}</Text>
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
              variant="primary"
              fullWidth
              style={styles.actionButton}
            />
            
            <ButtonNative
              text="Change Group Image"
              onPress={handleImagePress}
              variant="primary"
              fullWidth
              style={styles.actionButton}
              disabled={uploadingImage}
            />
            
            <ButtonNative
              text="Invite Users"
              onPress={handleInviteUsers}
              variant="primary"
              fullWidth
              style={styles.actionButton}
            />
            
            <ButtonNative
              text={isLeavingGroup ? "Leaving Group..." : "Leave Group"}
              onPress={handleLeaveGroup}
              variant="danger"
              fullWidth
              style={styles.leaveGroupButton}
              disabled={isLeavingGroup}
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

      {/* AttachmentPickerModal */}
      <AttachmentPickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onCamera={handleCamera}
        onImagePicker={handleImagePicker}
        onDocumentPicker={handleDocumentPicker}
        showDocuments={false}
        title="Change Group Image"
        accentColor="#1C6B1C"
      />

      {/* Invite Users Modal */}
      <InviteUsersModalNative
        visible={showInviteModal}
        conversationId={conversationId}
        groupName={displayName}
        existingParticipants={currentConversation?.participants || []}
        onClose={handleInviteModalClose}
        onInvitesSent={handleInvitesSent}
      />
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
    backgroundColor: '#1C6B1C'
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
  leaveGroupButton: {
    marginBottom: 8, // Extra space before leave group button
  },
});