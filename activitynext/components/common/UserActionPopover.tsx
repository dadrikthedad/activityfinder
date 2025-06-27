// UserActionPopover.tsx - Updated to use overlay ref properly
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import UserActionPopoverContent from "./UserActionPopoverContent";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useFriendWith } from "@/hooks/useFriendWith";
import { useAuth } from "@/context/AuthContext";
import { useOverlay } from "@/context/OverlayProvider";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import NewMessageWindow from "../messages/NewMessageWindow";
import { MessageDTO } from "@/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";


interface UserActionPopoverProps {
  user: UserSummaryDTO;
  avatarSize?: number;
  onRemoveSuccess?: () => void;
  onCloseDropdown?: () => void;
  position: { x: number; y: number };
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
  conversationId?: number;
  zIndex?: number;
  // ✅ NEW: Accept the overlay ref from parent
  overlayRef?: (element: HTMLElement | null) => void;
}

export default React.memo(function UserActionPopover(props: UserActionPopoverProps) {
  const { 
    user, 
    onRemoveSuccess, 
    onCloseDropdown,
    position,
    isGroup = false, 
    participants = [], 
    onLeaveGroup, 
    isPendingRequest = false,
    zIndex,
    overlayRef // ✅ NEW: Receive overlay ref
  } = props;
  
  console.log('👤 OVERLAY UserActionPopover rendered:', {
    userId: user.id,
    userName: user.fullName,
    position,
  });

  // Only need overlay for new message window (not nested popover anymore)
  const newMessageOverlay = useOverlay(); // New message window

  // State
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();

  // Hooks
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(user.id);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter();

  // Sync state with overlay
  useEffect(() => {
    if (!newMessageOverlay.isOpen && showNewMessageWindow) {
      setShowNewMessageWindow(false);
      setNewMessageInitialReceiver(undefined);
    }
  }, [newMessageOverlay.isOpen, showNewMessageWindow]);

  // Event handlers
  const handleRemove = async () => {
    console.log('🗑️ Removing friend:', user.fullName);
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    handleClose();
  };
  
  const handleClose = useCallback(() => {
    console.log('❌ OVERLAY Closing UserActionPopover:', { userId: user.id });
    
    // Close new message window if open
    if (newMessageOverlay.isOpen) {
      newMessageOverlay.close();
    }

    // Tell parent to close (UserActionPopoverPortal)
    if (onCloseDropdown) {
      onCloseDropdown();
    }
  }, [newMessageOverlay, user.id, onCloseDropdown]);

  const handleVisitProfile = () => {
    console.log('👤 Visiting profile for:', user.fullName);
    router.push(`/profile/${user.id}`);
    handleClose();
  };

  const handleSendMessage = () => {
    console.log('📝 Send message clicked for:', user.fullName);
    setNewMessageInitialReceiver(user);
    setShowNewMessageWindow(true);
    newMessageOverlay.open();
  };

  const handleCloseNewMessageWindow = useCallback(() => {
    console.log('📝 Closing new message window');
    setShowNewMessageWindow(false);
    setNewMessageInitialReceiver(undefined);
    newMessageOverlay.close();
  }, [newMessageOverlay]);

  const handleMessageSent = (message: MessageDTO) => {
    console.log("📤 Message sent from popover:", message);
    handleCloseNewMessageWindow();
    handleClose();
  };

  const handleGroupCreated = (response: SendGroupRequestsResponseDTO) => {
    console.log("👥 Group created from popover:", response);
    handleCloseNewMessageWindow();
    handleClose();
  };

  // ✅ REMOVED: Old nested popover logic - now handled by ParticipantsDropdownButton
  const handleShowUserPopover = () => {
    console.log('👥 UserActionPopover handleShowUserPopover called - but ParticipantsDropdownButton should handle this locally');
    // This is now handled locally in ParticipantsDropdownButton
  };

  const handleLeaveGroup = () => {
    console.log('🚪 Leaving group');
    if (onLeaveGroup) {
      onLeaveGroup();
    }
    handleClose();
  };

  const handleInviteUsers = () => {
    console.log("👥 Invite users clicked!");
    handleClose();
  };

  return (
    <>
      {/* ✅ FIXED: Attach the overlay ref to the main popover div */}
      <div
        ref={overlayRef} // ✅ This connects the main popover to the overlay system
        style={{
          position: "fixed",
          top: position.y,
          left: position.x,
          zIndex: zIndex || 1002,
        }}
      >
        <UserActionPopoverContent
          user={user}
          isOwner={isOwner}
          isFriend={!!isFriend}
          isFriendLoading={isFriendLoading}
          onVisitProfile={handleVisitProfile}
          onSendMessage={handleSendMessage}
          onRemoveFriend={handleRemove}
          onClose={handleClose}
          isGroup={isGroup}
          participants={participants}
          onLeaveGroup={handleLeaveGroup}
          onShowUserPopover={handleShowUserPopover}
          isPendingRequest={isPendingRequest}
          onInviteUsers={isGroup ? handleInviteUsers : undefined}
        />
      </div>

      {/* ✅ REMOVED: Nested popover - now handled locally in ParticipantsDropdownButton */}

      {/* New Message Window */}
      {newMessageOverlay.isOpen && showNewMessageWindow && createPortal(
        <div ref={newMessageOverlay.ref} style={{ zIndex: newMessageOverlay.zIndex }}>
          <NewMessageWindow
            initialReceiver={newMessageInitialReceiver}
            initialPosition={{ x: 500, y: 300 }}
            onClose={handleCloseNewMessageWindow}
            useOverlaySystem={false}
            onMessageSent={handleMessageSent}
            onGroupCreated={handleGroupCreated}
          />
        </div>,
        document.body
      )}
    </>
  );
});