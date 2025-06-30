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
  console.log('🔗 OVERLAY NestedUserActionPopover rendered for:', user.fullName);
 
  const overlay = useOverlay();
  
  // ✅ Use comprehensive hook with legacy API support
  const {
    isOwner,
    handleVisitProfile,
    handleSendMessage,
    handleRemoveFriend,
    handleClose
  } = useUserActionPopover({
    user,
    onClose, // ✅ Legacy API support
    onSendMessageToUser: onSendMessage, // ✅ Legacy API support
    isNested: true // ✅ Mark as nested for different behavior
  });

  // Rest of component stays the same...
  useEffect(() => {
    console.log('🔗 OVERLAY NestedUserActionPopover opening overlay');
    overlay.open();
  }, [overlay]);

  useOverlayAutoClose(() => {
    console.log('🔗 OVERLAY NestedUserActionPopover auto-close triggered');
    onClose();
  }, overlay.level ?? undefined);

  const handleOverlayClose = () => {
    console.log('🔗 OVERLAY Closing nested UserActionPopover');
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
        isFriend={false}
        isFriendLoading={false}
        onVisitProfile={handleVisitProfile} // ✅ Includes closeAllLevels
        onSendMessage={handleSendMessage}
        onRemoveFriend={handleRemoveFriend} // ✅ No-op for nested
        onClose={handleOverlayClose}
        isGroup={false}
      />
    </div>,
    document.body
  );
}