// hooks/useUserActionPopover.ts - Comprehensive hook with all UserActionPopover logic
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOverlay, useOverlayLayer } from "@/context/OverlayProvider";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useFriendWith } from "@/hooks/useFriendWith";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { MessageDTO } from "@/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";

interface UseUserActionPopoverProps {
  user: UserSummaryDTO;
  onRemoveSuccess?: () => void;
  onCloseDropdown?: () => void;
  onLeaveGroup?: () => void;
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  conversationId?: number;
  // Configuration for simplified usage (like nested popover)
  isSimplified?: boolean;
  // Legacy API support for NestedUserActionPopover
  onClose?: () => void;
  onSendMessageToUser?: (user: UserSummaryDTO) => void;
  isNested?: boolean;
}

export function useUserActionPopover({
  user,
  onRemoveSuccess,
  onCloseDropdown,
  onLeaveGroup,
  isSimplified = false,
  // Legacy API support
  onClose,
  onSendMessageToUser,
  isNested = false
}: UseUserActionPopoverProps) {
  const router = useRouter();
  const { userId: currentUserId } = useAuth();
  const { closeAllLevels } = useOverlayLayer();

  // ✅ Always call hooks - React requires consistent hook order
  const confirmRemoveResult = useConfirmRemoveFriend();
  const friendResult = useFriendWith(user.id);
  
  // ✅ Use results conditionally, not the hooks themselves
  const { confirmAndRemove, ConfirmDialog } = (isSimplified || isNested)
    ? { confirmAndRemove: () => Promise.resolve(), ConfirmDialog: () => null }
    : confirmRemoveResult;
  
  const { isFriend, loading: isFriendLoading } = (isSimplified || isNested)
    ? { isFriend: false, loading: false }
    : friendResult;

  // ✅ Overlay hooks for additional windows (only in full mode)
  const newMessageOverlay = useOverlay();
  const inviteUsersOverlay = useOverlay();

  // ✅ State for additional windows
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();
  const [showInviteUsersWindow, setShowInviteUsersWindow] = useState(false);

  const isOwner = user.id === currentUserId;

  // ✅ Core handlers - used by both modes
  const handleVisitProfile = useCallback(() => {
    console.log('👤 Visiting profile for:', user.fullName);
    closeAllLevels();
    router.push(`/profile/${user.id}`);
  }, [user.id, user.fullName, router, closeAllLevels]);

  const handleClose = useCallback(() => {
    console.log('❌ Closing UserActionPopover:', { userId: user.id, isSimplified, isNested });
    
    if (!isSimplified && !isNested) {
      // Full cleanup for main popover
      if (newMessageOverlay.isOpen) {
        newMessageOverlay.close();
      }
      if (inviteUsersOverlay.isOpen) {
        inviteUsersOverlay.close();
      }
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
    user.id, 
    isSimplified,
    isNested,
    newMessageOverlay, 
    inviteUsersOverlay, 
    onClose,
    onCloseDropdown
  ]);

  const handleLeaveGroup = useCallback(() => {
    console.log('🚪 Leaving group');
    if (onLeaveGroup) {
      onLeaveGroup();
    }
    handleClose();
  }, [onLeaveGroup, handleClose]);

  // ✅ Friend-related handlers (only for non-simplified mode)
  const handleRemoveFriend = useCallback(async () => {
    if (isSimplified || isNested) return;
    
    console.log('🗑️ Removing friend:', user.fullName);
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    handleClose();
  }, [user, confirmAndRemove, onRemoveSuccess, handleClose, isSimplified, isNested]);

  // ✅ Send message handlers
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

    setNewMessageInitialReceiver(user);
    setShowNewMessageWindow(true);
    
    setTimeout(() => {
      newMessageOverlay.open();
    }, 0);
  }, [user, isSimplified, isNested, onSendMessageToUser, newMessageOverlay, handleClose]);

  const handleSendMessageToUserWrapper = useCallback((targetUser: UserSummaryDTO, onSendCallback?: (user: UserSummaryDTO) => void) => {
    console.log('📝 OVERLAY Send message from nested context to:', targetUser.fullName);
    
    if (onSendCallback) {
      onSendCallback(targetUser);
      if (isSimplified) {
        handleClose();
      }
      return;
    }

    if (!isSimplified) {
      setNewMessageInitialReceiver(targetUser);
      setShowNewMessageWindow(true);
      
      setTimeout(() => {
        newMessageOverlay.open();
      }, 0);
    }
  }, [isSimplified, newMessageOverlay, handleClose]);

  // ✅ New message window handlers (only for full mode)
  const handleCloseNewMessageWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    
    console.log('📝 Closing new message window');
    setShowNewMessageWindow(false);
    setNewMessageInitialReceiver(undefined);
    newMessageOverlay.close();
  }, [newMessageOverlay, isSimplified, isNested]);

  const handleMessageSent = useCallback((message: MessageDTO) => {
    console.log("📤 Message sent from popover:", message);
    handleCloseNewMessageWindow();
  }, [handleCloseNewMessageWindow]);

  const handleGroupCreated = useCallback((response: SendGroupRequestsResponseDTO) => {
    console.log("👥 Group created from popover:", response);
    handleCloseNewMessageWindow();
  }, [handleCloseNewMessageWindow]);

  // ✅ Invite users handlers (only for full mode)
  const handleOpenInviteWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    
    console.log('👥 Opening invite users window for group:', user.fullName);
    setShowInviteUsersWindow(true);
    
    setTimeout(() => {
      inviteUsersOverlay.open();
    }, 0);
  }, [user.fullName, inviteUsersOverlay, isSimplified, isNested]);

  const handleCloseInviteWindow = useCallback(() => {
    if (isSimplified || isNested) return;
    
    console.log('👥 Closing invite users window');
    setShowInviteUsersWindow(false);
    inviteUsersOverlay.close();
  }, [inviteUsersOverlay, isSimplified, isNested]);

  const handleInvitesSent = useCallback((response: unknown) => {
    console.log("👥 Invites sent from popover:", response);
    handleCloseInviteWindow();
  }, [handleCloseInviteWindow]);

  // ✅ Placeholder for nested popover handling
  const handleShowUserPopover = useCallback((targetUser: UserSummaryDTO) => {
    console.log('👥 UserActionPopover handleShowUserPopover called for:', targetUser.fullName);
    // This should be handled by the parent component
  }, []);

  // ✅ Debug logging (only for full mode)
  useEffect(() => {
    if (isSimplified || isNested) return;
    
    console.log('📝 OVERLAY Message window state:', {
      showNewMessageWindow,
      overlayOpen: newMessageOverlay.isOpen,
      hasReceiver: !!newMessageInitialReceiver,
      receiverName: newMessageInitialReceiver?.fullName
    });
  }, [showNewMessageWindow, newMessageOverlay.isOpen, newMessageInitialReceiver, isSimplified, isNested]);

  useEffect(() => {
    if (isSimplified || isNested) return;
    
    console.log('👥 OVERLAY Invite users window state:', {
      showInviteUsersWindow,
      overlayOpen: inviteUsersOverlay.isOpen,
      groupName: user.fullName
    });
  }, [showInviteUsersWindow, inviteUsersOverlay.isOpen, user.fullName, isSimplified, isNested]);

  // ✅ Return everything - components can pick what they need
  return {
    // Core properties
    isOwner,
    isFriend,
    isFriendLoading,

    // Core handlers
    handleVisitProfile,
    handleClose,
    handleLeaveGroup,
    handleSendMessage,
    handleRemoveFriend, // Legacy name for handleRemove
    handleRemove: handleRemoveFriend, // New name
    handleSendMessageToUser: handleSendMessageToUserWrapper,
    handleShowUserPopover,

    // New message window
    showNewMessageWindow,
    newMessageInitialReceiver,
    newMessageOverlay,
    handleCloseNewMessageWindow,
    handleMessageSent,
    handleGroupCreated,

    // Invite users window
    showInviteUsersWindow,
    inviteUsersOverlay,
    handleOpenInviteWindow,
    handleCloseInviteWindow,
    handleInvitesSent,

    // Components
    ConfirmDialog,

    // Nested handling
    handleSendMessageFromNested: handleSendMessageToUserWrapper
  };
}