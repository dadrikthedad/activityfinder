/* // UserActionPopoverContentNative.tsx - Updated for ModalContext
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useChatStore } from "@/store/useChatStore";
import { useModal } from "@/context/ModalContext";
import { useCallback } from "react";
import GroupSettingsScreen from "@/screens/messages/GroupSettingsScreen";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import MiniAvatarNative from "../MiniAvatarNative";
import ButtonNative from "../buttons/ButtonNative";
import DropdownButtonNative from "./DropdownButtonNative";
import InviteUsersModalNative from "@/components/messages/InviteUsersModalNative";
import NewMessageModalNative from "@/components/messages/NewMessage/NewMessageModalNative";

interface Props {
  user: UserSummaryDTO;
  isOwner: boolean;
  isFriend: boolean;
  isFriendLoading: boolean;
  // Blocking props
  isBlocked?: boolean;
  hasBlockedMe?: boolean;
  isBlocking?: boolean;
  isUnblocking?: boolean;
  onBlock?: () => void;
  onUnblock?: () => void;
  // Props
  onVisitProfile: () => void;
  onSendMessage: () => void;
  onRemoveFriend: () => void;
  onClose: () => void;
  // Group props
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  onShowUserPopover?: (user: UserSummaryDTO) => void;
  isPendingRequest?: boolean; 
  onInviteUsers?: () => void;
  conversationId?: number;
  onSendMessageFromNested?: (user: UserSummaryDTO) => void;
  onOpenInviteWindow?: (conversationId?: number, participants?: UserSummaryDTO[]) => void;
  isLeavingGroup?: boolean;
  navigation?: any; // 👈 NAVIGATION PROP
  closeModalOnAction?: boolean;
}

export default function UserActionPopoverContentNative({
  user,
  isOwner,
  isFriend,
  isFriendLoading,
  isBlocked = false,
  hasBlockedMe = false,
  isBlocking = false,
  isUnblocking = false,
  onBlock,
  onUnblock,
  onVisitProfile,
  onSendMessage,
  onRemoveFriend,
  onClose,
  isGroup = false,
  participants = [],
  onLeaveGroup,
  onShowUserPopover,
  isPendingRequest = false,
  onOpenInviteWindow,
  isLeavingGroup,
  conversationId,
  navigation, // 👈 NAVIGATION PROP
  closeModalOnAction = true,
}: Props) {

  // Get current group name from store for groups
  const currentConversation = useChatStore((state) => 
    isGroup && conversationId 
      ? state.conversations.find(conv => conv.id === conversationId)
      : null
  );
  
  // Use group name from store if available, otherwise fallback to user.fullName
  const displayName = isGroup && currentConversation?.groupName 
    ? currentConversation.groupName 
    : user.fullName;

  // Dynamic image from store
  const displayImage = isGroup && currentConversation?.groupImageUrl 
    ? currentConversation.groupImageUrl 
    : (user.profileImageUrl || (isGroup ? "/default-group.png" : "/default-avatar.png"));

  // Use ModalContext
  const { showModal, hideModal } = useModal();

  // Handler for opening group settings with ModalContext
  const handleOpenGroupSettings = useCallback(() => {
    if (!conversationId) return;
    
    showModal(
      <GroupSettingsModalNative
        visible={true}
        user={user}
        conversationId={conversationId}
        onClose={hideModal}
      />,
      {
        blurBackground: false,
        dismissOnBackdrop: false,
      }
    );
    
    onClose();
  }, [user, conversationId, onClose, showModal, hideModal]);

  // Handler for opening invite users modal (for existing groups)
  const handleInviteUsers = useCallback(() => {
    if (!conversationId) return;
    
    showModal(
      <InviteUsersModalNative
        visible={true}
        conversationId={conversationId}
        groupName={displayName}
        existingParticipants={participants}
        onClose={hideModal}
        onInvitesSent={(response: unknown) => {
          console.log('Invitations sent:', response);
        }}
      />,
      {
        blurBackground: false,
        dismissOnBackdrop: false,
      }
    );
    
    onClose();
  }, [conversationId, displayName, participants, showModal, hideModal, onClose]);

  // Handler for opening new message modal (for individual users)
  const handleSendMessage = useCallback(() => {
    showModal(
      <NewMessageModalNative
        visible={true}
        onClose={hideModal}
        onNavigateToChat={(conversationId: number) => {
          // Navigate to the new conversation
          navigation?.navigate('ConversationScreen', { conversationId });
          hideModal();
        }}
      />,
      {
        blurBackground: false,
        dismissOnBackdrop: false,
      }
    );
    
    onClose();
  }, [showModal, hideModal, onClose, navigation]);

  // Show participants list
  const handleShowParticipants = () => {
    navigation?.navigate('ParticipantsList', { 
      participants, 
      conversationId 
    });
    onClose();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.profileSection}>
          <MiniAvatarNative
            imageUrl={displayImage}
            size={80}
            alt={displayName || "Profile"}
            withBorder={true}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            {isGroup && (
              <Text style={styles.memberCount}>{participants.length} medlemmer</Text>
            )}
          </View>
        </View>
        <View style={styles.buttonContainer}>
          {isGroup ? (
            // Group Actions
            <>
              <ButtonNative
                text={`View Members (${participants.length})`}
                onPress={handleShowParticipants}
                variant="primary"
                size="medium"
                fullWidth={true}
              />


              {onOpenInviteWindow && !isPendingRequest && (
                <ButtonNative
                  text="Invite Users"
                  onPress={handleInviteUsers}
                  variant="primary"
                  size="medium"
                  fullWidth={true}
                />
              )}

              {!isPendingRequest && (
                <ButtonNative
                  text="Group Settings"
                  onPress={handleOpenGroupSettings}
                  variant="primary"
                  size="medium"
                  fullWidth={true}
                />
              )}

              {onLeaveGroup && !isPendingRequest && (
                <ButtonNative
                  text={isLeavingGroup ? "Leaving..." : "Leave Group"}
                  onPress={onLeaveGroup}
                  variant="danger"
                  size="medium"
                  fullWidth={true}
                  disabled={isLeavingGroup}
                  loading={isLeavingGroup}
                />
              )}
            </>
          ) : (
            // Individual User Actions
            <>
              <ButtonNative
                text="Visit Profile"
                onPress={onVisitProfile}
                variant="primary"
                size="medium"
                fullWidth={true}
              />

              {!isOwner && (
                <>
                  {!hasBlockedMe && !isBlocked && (
                    <ButtonNative
                      text="Send Message"
                      onPress={handleSendMessage} // 👈 BRUKER VÅR EGEN HANDLER
                      variant="primary"
                      size="medium"
                      fullWidth={true}
                    />
                  )}

                  {!isFriendLoading && (
                    <DropdownButtonNative
                      text="More Options"
                      actions={[
                        ...(isFriend && onRemoveFriend ? [{ 
                          label: "Remove Friend", 
                          onPress: onRemoveFriend 
                        }] : []),
                        ...(isBlocked && onUnblock && !isUnblocking ? [{ 
                          label: "Unblock", 
                          onPress: onUnblock 
                        }] : []),
                        ...(!hasBlockedMe && onBlock && !isBlocking ? [{ 
                          label: "Block", 
                          onPress: onBlock,
                          style: "destructive" as const
                        }] : []),
                        { 
                          label: "Report", 
                          onPress: () => Alert.alert("Report", "Report functionality not implemented"),
                          style: "destructive" as const
                        }
                      ]}
                      variant="secondary"
                      size="medium"
                    />
                  )}
                </>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#1C6B1C',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  content: {
    marginTop: 15,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
  },
}); */