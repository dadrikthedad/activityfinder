// components/common/UserActionPopoverPortal.tsx
"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { useOverlay, useOverlayAutoClose } from "@/context/OverlayProvider";
import UserActionPopover from "./UserActionPopover";

export default function UserActionPopoverPortal() {
  const { data, hide } = useUserActionPopoverStore();
  const overlay = useOverlay();

  // ✅ FORENKLING: Bare sync data med overlay åpning/lukking
  React.useEffect(() => {
    console.log('🌐 OVERLAY UserActionPopoverPortal data effect:', {
      hasData: !!data,
      overlayOpen: overlay.isOpen,
      userId: data?.user.id
    });
    
    if (data && !overlay.isOpen) {
      console.log('🌐 OVERLAY Opening portal overlay for:', data.user.fullName);
      overlay.open();
    } else if (!data && overlay.isOpen) {
      console.log('🌐 OVERLAY Closing portal overlay - no data');
      overlay.close();
    }
  }, [data]); // Kun data dependency

  // ✅ Bruk useOverlayAutoClose hook som finnes i OverlayProvider
    useOverlayAutoClose(() => {
    console.log('🌐 OVERLAY Auto-close triggered, hiding store data');
    hide();
  }, overlay.level ?? undefined);

  // Don't render if no data
  if (!data) {
    return null;
  }

  console.log('🌐 OVERLAY UserActionPopoverPortal rendering:', {
    position: data.position,
    zIndex: overlay.zIndex,
    level: overlay.level
  });

  return createPortal(
    <UserActionPopover
      key={`global-${data.user.id}`}
      user={data.user}
      onCloseDropdown={hide}
      position={data.position}
      isGroup={data.isGroup}
      participants={data.participants || []}
      onLeaveGroup={data.onLeaveGroup}
      isPendingRequest={data.isPendingRequest}
      conversationId={data.conversationId}
      zIndex={overlay.zIndex}
      // ✅ Pass the overlay ref to UserActionPopover
      overlayRef={overlay.ref}
    />,
    document.body
  );
}