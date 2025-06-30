"use client";
import React, { useEffect, useState, useCallback } from "react"; // ✅ LAGT TIL: useRef import
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import UserActionPopoverContent from "./UserActionPopoverContent";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useFriendWith } from "@/hooks/useFriendWith";
import { useAuth } from "@/context/AuthContext";
import { useOverlay } from "@/context/OverlayProvider";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import NewMessageWindow from "../messages/NewMessageWindow";
import InviteUsersWindow from "../messages/InviteUsersWindow"; // ✅ NEW import
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
  // Accept the overlay ref from parent
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
    conversationId,
    zIndex,
    overlayRef
  } = props;
  
  console.log('👤 OVERLAY UserActionPopover rendered:', {
    userId: user.id,
    userName: user.fullName,
    position,
  });

  // Only need overlay for new message window and invite users window
  const newMessageOverlay = useOverlay();
  const inviteUsersOverlay = useOverlay(); //overlay for invite users

  // State
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();
  // Invite users window state
  const [showInviteUsersWindow, setShowInviteUsersWindow] = useState(false);

  // Hooks
  const { confirmAndRemove, ConfirmDialog } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(user.id);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter();

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

    // Close invite users window if open
    if (inviteUsersOverlay.isOpen) {
      inviteUsersOverlay.close();
    }

    // Close any open window state
    setShowNewMessageWindow(false);
    setNewMessageInitialReceiver(undefined);
    setShowInviteUsersWindow(false); 

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
    
    // Force open the overlay - this ensures it works even in nested contexts
    setTimeout(() => {
      newMessageOverlay.open();
    }, 0);
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
    // Don't automatically close the UserActionPopover - let user decide
  };

  const handleGroupCreated = (response: SendGroupRequestsResponseDTO) => {
    console.log("👥 Group created from popover:", response);
    handleCloseNewMessageWindow();
    // Don't automatically close the UserActionPopover - let user decide

  };

  // Handle sending message from nested popover
  const handleSendMessageFromNested = useCallback((targetUser: UserSummaryDTO) => {
    console.log('📝 OVERLAY Send message from nested popover to:', targetUser.fullName);
    
    // Set up the message window for the target user
    setNewMessageInitialReceiver(targetUser);
    setShowNewMessageWindow(true);
    
    // Force open the overlay after a short delay to ensure state is set
    setTimeout(() => {
      newMessageOverlay.open();
    }, 0);
  }, [newMessageOverlay]);

  const handleShowUserPopover = (targetUser: UserSummaryDTO) => {
    console.log('👥 UserActionPopover handleShowUserPopover called for:', targetUser.fullName);
    // This should only show the user popover, NOT send message
    // The actual send message will be handled by onSendMessageFromNested
  };

  const handleLeaveGroup = () => {
    console.log('🚪 Leaving group');
    if (onLeaveGroup) {
      onLeaveGroup();
    }
    handleClose();
  };

  // Handle opening invite users window
  const handleOpenInviteWindow = useCallback(() => {
    console.log('👥 Opening invite users window for group:', user.fullName);
    setShowInviteUsersWindow(true);
    
    // Force open the overlay after a short delay to ensure state is set
    setTimeout(() => {
      inviteUsersOverlay.open();
    }, 0);
  }, [inviteUsersOverlay, user.fullName]);

  const handleCloseInviteWindow = useCallback(() => {
    console.log('👥 Closing invite users window');
    setShowInviteUsersWindow(false);
    inviteUsersOverlay.close();
  }, [inviteUsersOverlay]);

  const handleInvitesSent = (response: unknown) => {
    console.log("👥 Invites sent from popover:", response);
    handleCloseInviteWindow();
    // Don't automatically close the UserActionPopover - let user decide
  };

  // Debug logging for window states
  useEffect(() => {
    console.log('📝 OVERLAY Message window state:', {
      showNewMessageWindow,
      overlayOpen: newMessageOverlay.isOpen,
      hasReceiver: !!newMessageInitialReceiver,
      receiverName: newMessageInitialReceiver?.fullName
    });
  }, [showNewMessageWindow, newMessageOverlay.isOpen, newMessageInitialReceiver]);

  useEffect(() => {
    console.log('👥 OVERLAY Invite users window state:', {
      showInviteUsersWindow,
      overlayOpen: inviteUsersOverlay.isOpen,
      groupName: user.fullName
    });
  }, [showInviteUsersWindow, inviteUsersOverlay.isOpen, user.fullName]);

  return (
    <>
      {/* Attach the overlay ref to the main popover div */}
      <div
        ref={overlayRef}
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
          // ✅ NEW: Pass the new invite window handler
          onOpenInviteWindow={isGroup ? handleOpenInviteWindow : undefined}
          // ✅ Pass the nested send message handler
          onSendMessageFromNested={handleSendMessageFromNested}
        />
      </div>

       <ConfirmDialog />

      {/* New Message Window - Always render when showNewMessageWindow is true */}
      {showNewMessageWindow && newMessageInitialReceiver && (
        <>
          {newMessageOverlay.isOpen && createPortal(
            <div 
              ref={newMessageOverlay.ref} 
              style={{ 
                zIndex: newMessageOverlay.zIndex,
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none' // Allow clicks to pass through to positioned content
              }}
            >
              <div 
                style={{ 
                  position: 'absolute',
                  top: '300px',
                  left: '500px',
                  pointerEvents: 'auto' // Re-enable clicks for the actual window
                }}
              >
                <NewMessageWindow
                  initialReceiver={newMessageInitialReceiver}
                  initialPosition={{ x: 0, y: 0 }} // Position handled by parent div
                  onClose={handleCloseNewMessageWindow}
                  useOverlaySystem={false} // We're managing the overlay ourselves
                  onMessageSent={handleMessageSent}
                  onGroupCreated={handleGroupCreated}
                />
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* ✅ NEW: Invite Users Window */}
      {showInviteUsersWindow && isGroup && (
        <>
          {inviteUsersOverlay.isOpen && createPortal(
            <div 
              ref={inviteUsersOverlay.ref} 
              style={{ 
                zIndex: inviteUsersOverlay.zIndex,
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none' // Allow clicks to pass through to positioned content
              }}
            >
              <div 
                style={{ 
                  position: 'absolute',
                  top: '200px',
                  left: '600px',
                  pointerEvents: 'auto' // Re-enable clicks for the actual window
                }}
              >
                <InviteUsersWindow
                  conversationId={conversationId || 0} // You might need to pass this as a prop
                  groupName={user.fullName ?? "Group"}
                  existingParticipants={participants}
                  onClose={handleCloseInviteWindow}
                  onInvitesSent={handleInvitesSent}
                  initialPosition={{ x: 0, y: 0 }} // Position handled by parent div
                  useOverlaySystem={false} // We're managing the overlay ourselves
                />
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </>
  );
});