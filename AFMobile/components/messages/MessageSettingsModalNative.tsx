// components/messages/MessageSettingsModalNative.tsx - Forbedret versjon
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { X, Search, Trash2, Image, Bell } from 'lucide-react-native';
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

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icon, 
  title, 
  subtitle, 
  onPress, 
  destructive = false, 
  disabled = false 
}) => (
  <TouchableOpacity 
    style={[
      styles.menuItem, 
      destructive && styles.destructiveItem,
      disabled && styles.disabledItem
    ]} 
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <View style={styles.menuItemIcon}>
      {icon}
    </View>
    <View style={styles.menuItemContent}>
      <Text style={[
        styles.menuItemText, 
        destructive && styles.destructiveText,
        disabled && styles.disabledText
      ]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.menuItemSubtitle}>{subtitle}</Text>
      )}
    </View>
  </TouchableOpacity>
);

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

  const setSearchMode = useChatStore(state => state.setSearchMode);

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
    onClose(); // Lukk settings modal
    setSearchMode(true); // Aktiver søkemodus
  };

  const handleViewMedia = () => {
    // TODO: Implement media gallery
    console.log('View media gallery');
    onClose();
  };

  const handleNotificationSettings = () => {
    // TODO: Implement notification settings
    console.log('Notification settings');
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
      statusBarTranslucent={false}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isGroup ? 'Group Settings' : 'Settings for this conversation'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Group Header */}
            {isGroup && currentConversation && (
              <>
                <TouchableOpacity style={styles.groupHeader} onPress={handleGroupHeaderClick}>
                  <MiniAvatarNative
                    imageUrl={currentConversation.groupImageUrl ?? "/default-group.png"}
                    size={50}
                    alt={currentConversation.groupName || "Group"}
                    withBorder={false}
                  />
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>
                      {currentConversation.groupName || "Navnløs gruppe"}
                    </Text>
                    <Text style={styles.groupSubtitle}>
                      {participants.length} participants
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.sectionDivider} />
              </>
            )}

            {/* Main Actions */}
            <View style={styles.section}>
              <MenuItem
                icon={<Search size={20} color="#1C6B1C" />}
                title="Search messages"
                subtitle="Find messages in this conversation"
                onPress={handleSearchMessages}
              />
              
              <MenuItem
                icon={<Image size={20} color="#1C6B1C" />}
                title="Media & files"
                subtitle="Photos, videos and documents - COMING SOON"
                onPress={handleViewMedia}
              />
              
              <MenuItem
                icon={<Bell size={20} color="#1C6B1C" />}
                title="Notifications"
                subtitle="Customize notification settings - COMING SOON"
                onPress={handleNotificationSettings}
              />
            </View>

            {/* Group Participants */}
            {isGroup && (
              <>
                <View style={styles.sectionDivider} />
                <View style={styles.participantsHeader}>
                  <Text style={styles.participantsTitle}>
                    Participants ({participants.length})
                  </Text>
                </View>
                <ParticipantsListNative
                  participants={participants}
                  onParticipantClick={handleParticipantClick}
                  showGroupRequestStatus={true}
                />
              </>
            )}

            {/* Danger Zone */}
            <View style={styles.sectionDivider} />
            <View style={styles.section}>
              
              {!isGroup && currentConversationId && (
                <MenuItem
                  icon={<Trash2 size={20} color="#FFFFFF" />}
                  title={isDeleting ? 'Deleting...' : 'Delete conversation'}
                  subtitle="You will not receive more messages from this user, unless you open up the conversation again."
                  onPress={handleDeleteConversation}
                  destructive={true}
                  disabled={isDeleting}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  section: {
    backgroundColor: 'white',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  menuItemIcon: {
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  destructiveItem: {
    backgroundColor: '#9CA3AF',
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  disabledItem: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F9FAFB',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    backgroundColor: 'white',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  groupSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  participantsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});