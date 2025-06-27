// components/common/UserActionPopoverPortal.tsx
"use client";
import React from "react";
import { createPortal } from "react-dom";
import { useUserActionPopoverStore } from "@/store/useUserActionPopoverStore";
import { useOverlay } from "@/context/OverlayProvider"; // NY IMPORT
import UserActionPopover from "./UserActionPopover";


export default function UserActionPopoverPortal() {
  const { data, hide } = useUserActionPopoverStore();
    const overlay = useOverlay();

    // ✅ FIKSET: Sync overlay state med store data
  React.useEffect(() => {
    console.log('🌐 UserActionPopoverPortal data effect:', { 
      hasData: !!data, 
      overlayOpen: overlay.isOpen, 
      userId: data?.user.id 
    });

    if (data && !overlay.isOpen) {
      console.log('🌐 Opening portal overlay for:', data.user.fullName);
      overlay.open();
    } else if (!data && overlay.isOpen) {
      console.log('🌐 Closing portal overlay - no data');
      overlay.close();
    }
  }, [data]); // ✅ Kun data dependency for å unngå loops

  // ✅ FIKSET: Auto-close når overlay lukkes eksternt - med delay for å unngå race condition
  React.useEffect(() => {
    // Kun reagér på overlay lukking hvis vi har data
    if (!overlay.isOpen && data) {
      console.log('🌐 Overlay closed externally detected');
      
      // Kort delay for å la åpning fullføres først
      const timer = setTimeout(() => {
        // Dobbelsjekk at overlay fortsatt er lukket og vi fortsatt har data
        if (!overlay.isOpen && useUserActionPopoverStore.getState().data) {
          console.log('🌐 Confirmed: Overlay closed externally, hiding store data');
          hide();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [overlay.isOpen]);

  // ✅ Don't render if no data OR overlay is not open
  if (!data || !overlay.isOpen) {
    return null;
  }

  console.log('🌐 UserActionPopoverPortal rendering:', {
    position: data.position,
    zIndex: overlay.zIndex
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
        overlayRef={overlay.ref}
        zIndex={overlay.zIndex}
    />,
    document.body
    );
}