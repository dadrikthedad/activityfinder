// Oppdatert UserActionPopover.tsx - renere overlay håndtering
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
import { calculatePopoverPosition } from "./PopoverPositioning";

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
  overlayRef?: React.Ref<HTMLDivElement>;
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
    overlayRef
  } = props;
  
  console.log('👤 UserActionPopover rendered:', {
    userId: user.id,
    userName: user.fullName,
    position,
  });

  // ✅ Forenklet overlay system - kun 3 overlays
  const mainOverlay = useOverlay(); // Hovedpopover
  const nestedPopoverOverlay = useOverlay(); // Nested popover  
  const newMessageOverlay = useOverlay(); // New message window

  // State
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageInitialReceiver, setNewMessageInitialReceiver] = useState<UserSummaryDTO | undefined>();
  const [nestedUserPopover, setNestedUserPopover] = useState<{
    user: UserSummaryDTO;
    position: { x: number; y: number };
  } | null>(null);

  // Hooks
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const { isFriend, loading: isFriendLoading } = useFriendWith(user.id);
  const { userId: currentUserId } = useAuth();
  const isOwner = user.id === currentUserId;
  const router = useRouter();

  // ✅ Åpne hovedoverlay ved mount
  useEffect(() => {
    mainOverlay.open();
    return () => mainOverlay.close();
  }, []);

  // Sync states med overlays
  useEffect(() => {
    if (!newMessageOverlay.isOpen && showNewMessageWindow) {
      setShowNewMessageWindow(false);
      setNewMessageInitialReceiver(undefined);
    }
  }, [newMessageOverlay.isOpen, showNewMessageWindow]);

  useEffect(() => {
    if (!nestedPopoverOverlay.isOpen && nestedUserPopover) {
      setNestedUserPopover(null);
    }
  }, [nestedPopoverOverlay.isOpen, nestedUserPopover]);

  // Event handlers
  const handleRemove = async () => {
    console.log('🗑️ Removing friend:', user.fullName);
    await confirmAndRemove(user.id, user.fullName ?? "this user", onRemoveSuccess);
    handleClose();
  };
  
  const handleClose = useCallback(() => {
    console.log('❌ Closing UserActionPopover:', { userId: user.id });
    
    // Close nested features first
    if (nestedPopoverOverlay.isOpen) {
      nestedPopoverOverlay.close();
    }
    
    if (newMessageOverlay.isOpen) {
      newMessageOverlay.close();
    }

    // Close main overlay
    mainOverlay.close();

    // Tell parent to close
    if (onCloseDropdown) {
      onCloseDropdown();
    }
  }, [nestedPopoverOverlay, newMessageOverlay, mainOverlay, user.id, onCloseDropdown]);

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

  // ✅ Din eksisterende handleShowUserPopover - perfekt som den er!
  const handleShowUserPopover = (participantUser: UserSummaryDTO, event: React.MouseEvent) => {
  console.log('👥 Showing nested popover for:', participantUser.fullName);
  
  // ✅ Bruk samme utility som ClickableAvatar
  const pos = calculatePopoverPosition(event);
  
  console.log('👥 Nested popover position:', {
    mousePos: { x: event.clientX, y: event.clientY },
    calculatedPos: pos,
    currentNestedUser: nestedUserPopover?.user.id,
    newUser: participantUser.id
  });
  
  // ✅ ENDRING: Ikke lukk eksisterende overlay, bare oppdater state
  // hvis (!nestedUserPopover) {
  //   nestedPopoverOverlay.open(); // Kun åpne hvis ingen eksisterer
  // }
  
  // ✅ Sjekk om overlay allerede er åpent
  if (!nestedPopoverOverlay.isOpen) {
    // Ingen nested popover åpen - åpne ny
    nestedPopoverOverlay.open();
  }
  
  // ✅ Oppdater state direkte - dette vil re-render med ny bruker og posisjon
  setNestedUserPopover({ user: participantUser, position: pos });
};

  const handleCloseNestedPopover = useCallback(() => {
    console.log('❌ Closing nested popover');
    nestedPopoverOverlay.close();
    setNestedUserPopover(null);
  }, [nestedPopoverOverlay]);

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
      {/* Main popover - ✅ Forenklet ref håndtering */}
      {createPortal(
        <div
          ref={(el) => {
            // Støtt eksisterende overlayRef prop
            if (overlayRef) {
              if (typeof overlayRef === 'function') {
                overlayRef(el);
              } else {
                (overlayRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }
            }
            // Registrer med overlay system
            mainOverlay.ref(el);
          }}
          style={{
            position: "fixed",
            top: position.y,
            left: position.x,
            zIndex: mainOverlay.zIndex, // ✅ Auto z-index
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
        </div>,
        document.body
      )}

      {/* Nested popover - ✅ Automatisk høyere z-index */}
      {nestedPopoverOverlay.isOpen && nestedUserPopover && createPortal(
        <div
          ref={nestedPopoverOverlay.ref}
          style={{
            position: "fixed",
            top: nestedUserPopover.position.y,
            left: nestedUserPopover.position.x,
            zIndex: nestedPopoverOverlay.zIndex, // ✅ Automatisk høyere
          }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[200px]"
        >
          <UserActionPopoverContent
            user={nestedUserPopover.user}
            isOwner={nestedUserPopover.user.id === currentUserId}
            isFriend={false}
            isFriendLoading={false}
            onVisitProfile={() => {
              router.push(`/profile/${nestedUserPopover.user.id}`);
              handleCloseNestedPopover();
              handleClose();
            }}
            onSendMessage={() => {
              setNewMessageInitialReceiver(nestedUserPopover.user);
              setShowNewMessageWindow(true);
              newMessageOverlay.open();
              handleCloseNestedPopover();
            }}
            onRemoveFriend={() => {}}
            onClose={handleCloseNestedPopover}
            isGroup={false}
          />
        </div>,
        document.body
      )}

      {/* New Message Window - ✅ Høyeste z-index */}
      {newMessageOverlay.isOpen && showNewMessageWindow && createPortal(
        <div ref={newMessageOverlay.ref} style={{ zIndex: newMessageOverlay.zIndex }}>
          <NewMessageWindow
            initialReceiver={newMessageInitialReceiver}
            initialPosition={{ x: 500, y: 300 }}
            onClose={handleCloseNewMessageWindow}
            onMessageSent={handleMessageSent}
            onGroupCreated={handleGroupCreated}
          />
        </div>,
        document.body
      )}
    </>
  );
});