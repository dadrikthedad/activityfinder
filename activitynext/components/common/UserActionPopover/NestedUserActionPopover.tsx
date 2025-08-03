// NestedUserActionPopover.tsx - Using useUserActionPopover hook
"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import UserActionPopoverContent from "./UserActionPopoverContent";
import { useUserActionPopover } from "./useUserActionPopover";

interface NestedUserActionPopoverProps {
  user: UserSummaryDTO;
  position: { x: number; y: number };
  onClose: () => void;
  onSendMessage?: (user: UserSummaryDTO) => void;
}

export default function NestedUserActionPopover({
  user,
  position,
  onClose,
  onSendMessage
}: NestedUserActionPopoverProps) {
  const overlay = useOverlay();
  
  // ✅ Use comprehensive hook with legacy API support
  const {
    isOwner,
    isFriend,
    isFriendLoading,
    isBlocked, // Add blocking status
    hasBlockedMe, // Add blocked by status
    isBlocking, // Add blocking loading
    isUnblocking, // Add unblocking loading
    handleVisitProfile,
    handleSendMessage,
    handleRemoveFriend,
    handleBlock, // Add block handler
    handleUnblock,
    handleClose
  } = useUserActionPopover({
    user,
    onClose, // Legacy API support
    onSendMessageToUser: onSendMessage, // Legacy API support
    isNested: true // Mark as nested for different behavior
  });

  // Rest of component stays the same...
  useEffect(() => {
    overlay.open();
  }, [overlay]);

  useOverlayAutoClose(() => {
    onClose();
  }, overlay.level ?? undefined);

  const handleOverlayClose = () => {
    overlay.close();
    handleClose();
  };

  return createPortal(
    <div
      ref={overlay.ref}
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        zIndex: overlay.zIndex,
      }}
    >
      <UserActionPopoverContent
        user={user}
        isOwner={isOwner}
        isFriend={isFriend} // Use actual friend status from store
        isFriendLoading={isFriendLoading}
        isBlocked={isBlocked} // Add blocking status
        hasBlockedMe={hasBlockedMe} // Add blocked by status
        isBlocking={isBlocking} // Add blocking loading
        isUnblocking={isUnblocking} // Add unblocking loading
        onBlock={handleBlock} // Add block handler
        onUnblock={handleUnblock} // Add unblock handler
        onVisitProfile={handleVisitProfile} // Includes closeAllLevels
        onSendMessage={handleSendMessage}
        onRemoveFriend={handleRemoveFriend} // No-op for nested
        onClose={handleOverlayClose}
        isGroup={false}
      />
    </div>,
    document.body
  );
}