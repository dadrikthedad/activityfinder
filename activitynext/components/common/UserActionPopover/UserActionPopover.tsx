"use client";
import React from "react";
import { createPortal } from "react-dom";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import UserActionPopoverContent from "./UserActionPopoverContent";
import NewMessageWindow from "../../messages/NewMessageWindow";
import InviteUsersWindow from "../../messages/InviteUsersWindow";
import { useUserActionPopover } from "./useUserActionPopover";

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
  
  // ✅ Use comprehensive hook with full functionality
  const {
    isOwner,
    isFriend,
    isFriendLoading,
    isBlocked, // User we have blocked
    hasBlockedMe, // User who blocked us
    isBlocking, // Block operation loading
    isUnblocking, // Unblock operation loading
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
    showNewMessageWindow,
    newMessageInitialReceiver,
    newMessageOverlay,
    handleCloseNewMessageWindow,
    handleMessageSent,
    handleGroupCreated,
    showInviteUsersWindow,
    inviteUsersOverlay,
    handleOpenInviteWindow,
    handleCloseInviteWindow,
    handleInvitesSent,
    ConfirmDialog,
  } = useUserActionPopover({
    user,
    onRemoveSuccess,
    onCloseDropdown,
    onLeaveGroup,
    isGroup,
    participants,
    conversationId,
    isSimplified: false // Full functionality
  });

  return (
    <>
      {/* Main popover content */}
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
          onOpenInviteWindow={isGroup ? handleOpenInviteWindow : undefined}
          onSendMessageFromNested={handleSendMessageFromNested}
          conversationId={conversationId}
                />
      </div>

      <ConfirmDialog />

      {/* New Message Window */}
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
                pointerEvents: 'none'
              }}
            >
              <div 
                style={{ 
                  position: 'absolute',
                  top: '300px',
                  left: '500px',
                  pointerEvents: 'auto'
                }}
              >
                <NewMessageWindow
                  initialReceiver={newMessageInitialReceiver}
                  initialPosition={{ x: 0, y: 0 }}
                  onClose={handleCloseNewMessageWindow}
                  useOverlaySystem={false}
                  onMessageSent={handleMessageSent}
                  onGroupCreated={handleGroupCreated}
                />
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* Invite Users Window */}
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
                pointerEvents: 'none'
              }}
            >
              <div 
                style={{ 
                  position: 'absolute',
                  top: '200px',
                  left: '600px',
                  pointerEvents: 'auto'
                }}
              >
                <InviteUsersWindow
                  conversationId={conversationId || 0}
                  groupName={user.fullName ?? "Group"}
                  existingParticipants={participants}
                  onClose={handleCloseInviteWindow}
                  onInvitesSent={handleInvitesSent}
                  initialPosition={{ x: 0, y: 0 }}
                  useOverlaySystem={false}
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