// hooks/useUserActionPopover.ts - Comprehensive hook with all UserActionPopover logic
import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { MessageDTO } from "@shared/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@shared/types/SendGroupRequestsDTO";
import { useLeaveGroup } from "@/hooks/messages/useLeaveGroup";
import { useBlockUser } from "@/hooks/block/useBlockUser";
import { useUnblockUser } from "@/hooks/block/useUnblockUser";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useConfirmModal } from "@/hooks/useConfirmModal";

// React Native navigation
interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
}

interface UseUserActionPopoverProps {
  user: UserSummaryDTO;
  onRemoveSuccess?: () => void;
  onCloseDropdown?: () => void;
  onLeaveGroup?: () => void;
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  conversationId?: number;
  isSimplified?: boolean;
  onClose?: () => void;
  onSendMessageToUser?: (user: UserSummaryDTO) => void;
  isNested?: boolean;
  // React Native specific
  navigation?: NavigationProp;
}

export function useUserActionPopoverNative({
  user,
  onRemoveSuccess,
  onCloseDropdown,
  onLeaveGroup,
  isSimplified = false,
  onClose,
  onSendMessageToUser,
  conversationId,
  isNested = false,
  navigation, // React Native navigation
  isGroup = false,
  participants = [], // Add this with default value
}: UseUserActionPopoverProps) {
  const { userId: currentUserId } = useAuth();

  // Get user relationship info from store
  const { getUser } = useUserCacheStore();
  const cachedUser = getUser(user.id);
  const isFriend = cachedUser?.isFriend || false;
  const isBlocked = cachedUser?.isBlocked || false;
  const hasBlockedMe = cachedUser?.hasBlockedMe || false;

  // Always call hooks - React requires consistent hook order
  const confirmRemoveResult = useConfirmRemoveFriend();
  const { leaveGroupMutation, isLeavingGroup, error: leaveGroupError } = useLeaveGroup();
  const { blockUser, isLoading: isBlocking, error: blockError } = useBlockUser();
  const { unblockUser, isLoading: isUnblocking, error: unblockError } = useUnblockUser();

  // Use results conditionally, not the hooks themselves
  const { confirmAndRemove } = (isSimplified || isNested)
    ? { confirmAndRemove: () => Promise.resolve() }
    : confirmRemoveResult;

  const { confirm } = useConfirmModal();

  // Note: useConfirmModal handles rendering internally, no ConfirmDialog component needed

  // State for additional windows (React Native uses Modal instead of overlays)
  // Note: These are not used with Stack Navigation, kept for compatibility
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();
  const [showInviteUsersWindow, setShowInviteUsersWindow] = useState(false);

  const isOwner = user.id === currentUserId;

  

  const handleClose = useCallback(() => {
    if (!isSimplified && !isNested) {
      // Full cleanup for main popover
      setShowNewMessageWindow(false);
      setNewMessageInitialReceiver(undefined);
      setShowInviteUsersWindow(false);
    }

    // Call appropriate close callback
    if (onClose) {
      onClose(); // Legacy API
    } else if (onCloseDropdown) {
      onCloseDropdown(); // New API
    }
  }, [
    isSimplified,
    isNested,
    onClose,
    onCloseDropdown
  ]);

  // Core handlers
   const handleVisitProfile = useCallback(() => {
    if (navigation) {
      navigation.navigate('Profile', { userId: user.id });
      handleClose(); // Close after navigation
    } else {
      handleClose(); // Close if no navigation
    }
  }, [user.id, navigation, handleClose]);

  // Block/Unblock handlers
  const handleBlock = useCallback(async () => {
    if (isSimplified) return;
    
    console.log('🚫 Blocking user:', user.fullName);
    const response = await blockUser(user.id);
    if (response) {
      console.log('✅ User blocked:', response.message);
    }
  }, [user, blockUser, isSimplified]);

  const handleUnblock = useCallback(async () => {
    if (isSimplified) return;
    
    console.log('✅ Unblocking user:', user.fullName);
    const response = await unblockUser(user.id);
    if (response) {
      console.log('✅ User unblocked:', response.message);
    }
  }, [user, unblockUser, isSimplified]);

  const handleLeaveGroup = useCallback(async () => {
    console.log('🚪 Attempting to leave group:', conversationId);
    
    if (!conversationId) {
      console.error('❌ Cannot leave group: No conversationId provided');
      return;
    }

    // Show confirmation dialog - React Native version (plain text)
    const displayGroupName = user.fullName || "this group";
    const confirmed = await confirm({
      title: "Leave Group",
      message: `Are you sure you want to leave ${displayGroupName}? You will no longer receive messages from this group.`,
    });

    if (!confirmed) {
      console.log('🚪 Leave group cancelled by user');
      return;
    }

    try {
      console.log('🚪 Proceeding to leave group:', conversationId);
      
      // Call the leave group API
      await leaveGroupMutation(conversationId);
      
      // Call the parent callback if provided
      if (onLeaveGroup) {
        onLeaveGroup();
      }
      
      // Close the popover
      handleClose();
      
      console.log('✅ Successfully left group');
    } catch (error) {
      console.error('❌ Failed to leave group:', error);
    }
  }, [conversationId, user.fullName, confirm, leaveGroupMutation, onLeaveGroup, handleClose]);

  // Friend-related handlers
  const handleRemoveFriend = useCallback(async () => {
    if (isSimplified || isNested) return;
    
    console.log('🗑️ Removing friend:', user.fullName);
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    handleClose();
  }, [user, confirmAndRemove, onRemoveSuccess, handleClose, isSimplified, isNested]);

  // Send message handlers
  const handleSendMessage = useCallback(() => {
    console.log('📝 Send message clicked for:', user.fullName);
    
    if (isNested && onSendMessageToUser) {
      // Legacy nested behavior
      onSendMessageToUser(user);
      handleClose();
      return;
    }
    
    if (isSimplified) {
      handleClose();
      return;
    }

    // React Native - navigate to chat or show modal
    if (navigation) {
      navigation.navigate('Chat', { user });
      handleClose();
    } else {
      setNewMessageInitialReceiver(user);
      setShowNewMessageWindow(true);
    }
  }, [user, isSimplified, isNested, onSendMessageToUser, navigation, handleClose]);

  const handleSendMessageToUserWrapper = useCallback((targetUser: UserSummaryDTO, onSendCallback?: (user: UserSummaryDTO) => void) => {
    if (onSendCallback) {
      onSendCallback(targetUser);
      if (isSimplified) {
        handleClose();
      }
      return;
    }

    if (!isSimplified) {
      if (navigation) {
        navigation.navigate('Chat', { user: targetUser });
        handleClose();
      } else {
        setNewMessageInitialReceiver(targetUser);
        setShowNewMessageWindow(true);
      }
    }
  }, [isSimplified, navigation, handleClose]);

  // Window handlers for React Native modals (not used with Stack Navigation)
  const handleCloseNewMessageWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    setShowNewMessageWindow(false);
    setNewMessageInitialReceiver(undefined);
  }, [isSimplified, isNested]);

  const handleMessageSent = useCallback((message: MessageDTO) => {
    console.log("📤 Message sent from popover:", message);
    handleCloseNewMessageWindow();
  }, [handleCloseNewMessageWindow]);

  const handleGroupCreated = useCallback((response: SendGroupRequestsResponseDTO) => {
    console.log("👥 Group created from popover:", response);
    handleCloseNewMessageWindow();
  }, [handleCloseNewMessageWindow]);

  // Invite users handlers (replaced by Stack Navigation)
  const handleOpenInviteWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    setShowInviteUsersWindow(true);
  }, [isSimplified, isNested]);

  const handleCloseInviteWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    setShowInviteUsersWindow(false);
  }, [isSimplified, isNested]);

  const handleInviteUsers = useCallback(() => {
    if (navigation) {
      navigation.navigate('InviteUsers', { 
        conversationId,
        participants 
      });
      handleClose();
    }
  }, [navigation, conversationId, participants, handleClose]);

  const handleShowUserPopover = useCallback((targetUser: UserSummaryDTO) => {
    console.log('👥 UserActionPopover handleShowUserPopover called for:', targetUser.fullName);
    // This should be handled by the parent component
  }, []);

  const CombinedConfirmDialogs = useCallback(() => (
    <>
      {/* All confirm dialogs now handled internally by useConfirmModal */}
    </>
  ), []);

  return {
    // Core properties
    isOwner,
    isFriend,
    isFriendLoading: false,
    isBlocked,
    hasBlockedMe,
    isBlocking,
    isUnblocking,
    isLeavingGroup,
    leaveGroupError,
    blockError,
    unblockError,

    // Core handlers
    handleVisitProfile,
    handleClose,
    handleLeaveGroup,
    handleSendMessage,
    handleRemoveFriend,
    handleRemove: handleRemoveFriend,
    handleBlock,
    handleUnblock,
    handleSendMessageToUser: handleSendMessageToUserWrapper,
    handleShowUserPopover,

    // New message window (React Native modals - not used with Stack Navigation)
    showNewMessageWindow,
    newMessageInitialReceiver,
    handleCloseNewMessageWindow,
    handleMessageSent,
    handleGroupCreated,

    // Invite users window (replaced by Stack Navigation)
    showInviteUsersWindow,
    handleOpenInviteWindow,
    handleCloseInviteWindow,

    // Components
    ConfirmDialog: CombinedConfirmDialogs,

    // Nested handling
    handleSendMessageFromNested: handleSendMessageToUserWrapper,
    
    // Stack Navigation handlers
    handleInviteUsers,
  };
}