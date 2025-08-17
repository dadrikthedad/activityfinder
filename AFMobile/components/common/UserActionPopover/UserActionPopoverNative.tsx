// components/common/UserActionPopoverNative.tsx
import React from "react";
import { Modal, View, TouchableWithoutFeedback, StyleSheet, Dimensions } from "react-native";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import UserActionPopoverContentNative from "./UserActionPopoverContentNative";
import { useUserActionPopoverNative } from "./useUserActionPopoverNative";
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface UserActionPopoverNativeProps {
  user: UserSummaryDTO;
  visible: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
  conversationId?: number;
  onRemoveSuccess?: () => void;
  closeModalOnAction?: boolean; 
}

export default function UserActionPopoverNative(props: UserActionPopoverNativeProps) {
  const { 
    user, 
    visible,
    onClose,
    position = { x: screenWidth / 2, y: screenHeight / 2 },
    isGroup = false, 
    participants = [], 
    onLeaveGroup, 
    isPendingRequest = false,
    conversationId,
    onRemoveSuccess,
    closeModalOnAction = true,
  } = props;
  const navigation = useNavigation();
  
  const {
    isOwner,
    isFriend,
    isFriendLoading,
    isBlocked,
    hasBlockedMe,
    isBlocking,
    isUnblocking,
    isLeavingGroup,
    handleVisitProfile,
    handleClose,
    handleLeaveGroup,
    handleSendMessage,
    handleRemove,
    handleBlock,
    handleUnblock,
    handleShowUserPopover,
    handleSendMessageFromNested,
    handleInviteUsers,
    ConfirmDialog,
  } = useUserActionPopoverNative({
    user,
    onRemoveSuccess,
    onCloseDropdown: closeModalOnAction ? onClose : undefined,
    onLeaveGroup,
    isGroup,
    participants,
    conversationId,
    isSimplified: false,
    navigation, // Pass navigation to hook
    closeModalOnAction,
  });

  // Calculate position for popover
  const popoverStyle = {
    position: 'absolute' as const,
    left: Math.min(position.x, screenWidth - 250), // Avoid overflow
    top: Math.min(position.y, screenHeight - 300),
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5, // Android shadow
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={popoverStyle}>
                <UserActionPopoverContentNative
                  user={user}
                  isOwner={isOwner}
                  isFriend={!!isFriend}
                  isFriendLoading={isFriendLoading}
                  isBlocked={isBlocked} 
                  hasBlockedMe={hasBlockedMe} 
                  isBlocking={isBlocking} 
                  isUnblocking={isUnblocking}
                  onBlock={handleBlock}
                  onUnblock={handleUnblock} 
                  isLeavingGroup={isLeavingGroup}
                  onVisitProfile={handleVisitProfile}
                  onSendMessage={handleSendMessage}
                  onRemoveFriend={handleRemove}
                  onClose={handleClose}
                  isGroup={isGroup}
                  participants={participants}
                  onLeaveGroup={handleLeaveGroup}
                  onShowUserPopover={handleShowUserPopover}
                  isPendingRequest={isPendingRequest}
                  onOpenInviteWindow={isGroup ? handleInviteUsers : undefined}
                  onSendMessageFromNested={handleSendMessageFromNested}
                  conversationId={conversationId}
                  navigation={navigation}
                  closeModalOnAction={closeModalOnAction}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ConfirmDialog />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});