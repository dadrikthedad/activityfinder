// NestedUserActionPopover.tsx - Reusable nested UserActionPopover component
"use client";
import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import { useOverlay, useOverlayAutoClose, useOverlayLayer } from "@/context/OverlayProvider";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import UserActionPopoverContent from "./UserActionPopoverContent";

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
  const { closeAllLevels } = useOverlayLayer(); 
  const { userId: currentUserId } = useAuth();
  const router = useRouter();

  // Auto-open overlay when component mounts
  useEffect(() => {
    console.log('🔗 OVERLAY NestedUserActionPopover opening overlay');
    overlay.open();
  }, [overlay]);

  // Auto-close when overlay system closes us externally
  useOverlayAutoClose(() => {
    console.log('🔗 OVERLAY NestedUserActionPopover auto-close triggered');
    onClose();
  }, overlay.level ?? undefined);

  const handleVisitProfile = useCallback(() => {
    router.push(`/profile/${user.id}`);
    closeAllLevels();

  }, [user, router, closeAllLevels]);

  const handleSendMessage = useCallback(() => {
    console.log('🔗 OVERLAY Send message to:', user.fullName);
    if (onSendMessage) {
      onSendMessage(user);
    }
    onClose();
  }, [user, onSendMessage, onClose]);

  const handleClose = useCallback(() => {
    console.log('🔗 OVERLAY Closing nested UserActionPopover');
    overlay.close();
    onClose();
  }, [overlay, onClose]);

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
        isOwner={user.id === currentUserId}
        isFriend={false} // Simplified for nested usage
        isFriendLoading={false}
        onVisitProfile={handleVisitProfile}
        onSendMessage={handleSendMessage}
        onRemoveFriend={() => {}} // Not available in nested context
        onClose={handleClose}
        isGroup={false}
      />
    </div>,
    document.body
  );
}