// components/messages/MessageSettingsModalNative.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useChatStore } from '@/store/useChatStore';
import { useDeleteConversation } from '@/hooks/messages/useDeleteConversation';
import { useAuth } from '@/context/AuthContext';
import { ParticipantsListNative } from './ParticipantsListNative';
import MiniAvatarNative from '../common/MiniAvatarNative';

interface MessageSettingsModalNativeProps {
  visible: boolean;
  onClose: () => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
}

export function MessageSettingsModalNative({
  visible,
  onClose,
  onShowUserPopover,
}: MessageSettingsModalNativeProps) {
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const currentConversation = useChatStore((s) => 
    s.conversations.find((c) => c.id === currentConversationId)
  );
  const participants = currentConversation?.participants || [];
  const isGroup = currentConversation?.isGroup || false;
  
  const { deleteConversationMutation, isDeleting } = useDeleteConversation();
  const { userId: currentUserId } = useAuth();

  const handleDeleteConversation = () => {
    if (!currentConversationId || isGroup) return;
    
    const otherParticipant = participants.find(p => p.id !== currentUserId);
    const conversationName = otherParticipant?.fullName || "this conversation";
    const isPending = currentConversation?.isPendingApproval;
    
    Alert.alert(
      isPending ? "Remove Pending Request" : "Delete Conversation",
      `Are you sure you want to ${isPending ? 'remove the pending conversation request with' : 'delete the conversation with'} ${conversationName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isPending ? "Remove" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteConversationMutation(currentConversationId);
              onClose();
            } catch (error) {
              console.error('Failed to delete conversation:', error);
            }
          }
        }
      ]
    );
  };

  const handleSearchMessages = () => {
    // Toggle search mode in store
    const searchMode = useChatStore.getState().searchMode;
    useChatStore.getState().setSearchMode(!searchMode);
    onClose();
  };

  const handleParticipantClick = (participant: UserSummaryDTO) => {
    if (onShowUserPopover) {
      onShowUserPopover(participant, { x: 0, y: 0 });
    }
    onClose();
  };

  const handleGroupHeaderClick = () => {
    if (!isGroup || !currentConversation || !currentConversationId) return;
    
    const groupUser: UserSummaryDTO = {
      id: currentConversation.id,
      fullName: currentConversation.groupName || "Navnløs gruppe",
      profileImageUrl: currentConversation.groupImageUrl || "/default-group.png",
    };
    
    if (onShowUserPopover) {
      onShowUserPopover(groupUser, { x: 0, y: 0 });
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conversation Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.modalContent}>
            {/* Search Messages */}
            <TouchableOpacity style={styles.menuItem} onPress={handleSearchMessages}>
              <Text style={styles.menuItemText}>Search messages</Text>
            </TouchableOpacity>

            {/* Delete Conversation (only for non-groups) */}
            {!isGroup && currentConversationId && (
              <TouchableOpacity 
                style={[styles.menuItem, styles.destructiveItem]} 
                onPress={handleDeleteConversation}
                disabled={isDeleting}
              >
                <Text style={styles.destructiveText}>
                  {isDeleting ? 'Deleting...' : 'Delete conversation'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Group Participants */}
            {isGroup && (
              <>
                <View style={styles.sectionDivider} />
                
                {/* Group Header */}
                {currentConversation && (
                  <TouchableOpacity style={styles.groupHeader} onPress={handleGroupHeaderClick}>
                    <MiniAvatarNative
                      imageUrl={currentConversation.groupImageUrl ?? "/default-group.png"}
                      size={40}
                      alt={currentConversation.groupName || "Group"}
                      withBorder={false}
                    />
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>
                        {currentConversation.groupName || "Navnløs gruppe"}
                      </Text>
                      <Text style={styles.groupSubtitle}>Group settings</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Participants Header */}
                <View style={styles.participantsHeader}>
                  <Text style={styles.participantsTitle}>
                    Participants ({participants.length})
                  </Text>
                </View>

                {/* Participants List */}
                <ParticipantsListNative
                  participants={participants}
                  onParticipantClick={handleParticipantClick}
                  showGroupRequestStatus={true}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // MessageSettingsModalNative styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuItemText: {
    fontSize: 16,
    color: '#374151',
  },
  destructiveItem: {
    backgroundColor: '#FEF2F2',
  },
  destructiveText: {
    fontSize: 16,
    color: '#DC2626',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F9FAFB',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  groupSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  participantsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});